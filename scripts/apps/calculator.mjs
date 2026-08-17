import { MODULE, TEMPLATES } from '../constants.mjs';
import { TravelCalculator } from '../travel-calculator.mjs';
import { formatMountSpeed, getEnabledMountUuids, getMountSpeed, resolveMount, travelUnits, unitAbbreviation } from '../utils.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** The travel calculator window. */
export class TravelPaceApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static PARTS = { main: { template: TEMPLATES.CALCULATOR } };

  static DEFAULT_OPTIONS = {
    id: MODULE.APP_ID,
    classes: ['travel-calculator-window'],
    position: { height: 'auto', width: 300, top: 74, left: 120 },
    actions: { submitCalculation: TravelPaceApp.#submitCalculation },
    window: { icon: 'fa-solid fa-route', title: 'TRAVELPACE.Title', resizable: false, minimizable: true }
  };

  /** @type {Map<string, foundry.documents.Actor>} Resolved mounts, keyed by the UUID their option carries. */
  #mounts = new Map();

  /** @type {number|null} Hook id for the Calendaria weather listener. */
  #weatherHookId = null;

  /**
   * Open the calculator, or bring the open one forward.
   * @returns {void}
   */
  static show() {
    const existing = foundry.applications.instances.get(MODULE.APP_ID);
    if (existing) existing.bringToFront();
    else new TravelPaceApp().render(true);
  }

  /** @inheritdoc */
  async _prepareContext() {
    return {
      unit: unitAbbreviation(travelUnits().length),
      modes: [
        { id: 'distance', label: 'TRAVELPACE.Modes.Distance' },
        { id: 'time', label: 'TRAVELPACE.Modes.Time' }
      ],
      paces: [
        { id: 'normal', label: 'TRAVELPACE.Paces.Normal' },
        { id: 'fast', label: 'TRAVELPACE.Paces.Fast' },
        { id: 'slow', label: 'TRAVELPACE.Paces.Slow' }
      ],
      mounts: await this.#loadMounts()
    };
  }

  /** @inheritdoc */
  _onFirstRender(_context, _options) {
    this.element.addEventListener('input', this.#onInputChange.bind(this));
    this.#weatherHookId = Hooks.on('calendaria.weatherChange', () => this.#updatePreview());
  }

  /** @inheritdoc */
  _onRender(_context, _options) {
    this.#setMode(this.element.querySelector('input[name="travelpace-mode"]:checked')?.value);
    this.#updatePreview();
    this.#updatePaceLabel();
  }

  /** @inheritdoc */
  _onClose(options) {
    super._onClose(options);
    if (this.#weatherHookId) Hooks.off('calendaria.weatherChange', this.#weatherHookId);
    this.#weatherHookId = null;
  }

  /**
   * Dispatch a form input event to the right update path.
   * @param {Event} event Input event from the calculator form
   */
  #onInputChange(event) {
    const { target } = event;
    if (target.name === 'travelpace-mode') this.#setMode(target.value);
    else if (target.id === 'travelpace-pace' || target.id === 'travelpace-mount') this.#updatePaceLabel();
    this.#updatePreview();
  }

  /**
   * Show the panel for the chosen calculation mode and hide the other.
   * @param {string} mode 'distance' or 'time'
   */
  #setMode(mode) {
    const distance = mode !== 'time';
    this.element.querySelector('.distance-to-time')?.toggleAttribute('hidden', !distance);
    this.element.querySelector('.time-to-distance')?.toggleAttribute('hidden', distance);
  }

  /**
   * Read the form into a calculator payload.
   * @returns {object} A payload for TravelCalculator.calculateTravel
   */
  #getFormData() {
    const form = this.element;
    const mode = form.querySelector('input[name="travelpace-mode"]:checked')?.value;
    const pace = form.querySelector('#travelpace-pace')?.value;
    const mount = this.#selectedMount();

    if (mode === 'distance') return { mode, pace, mount, distance: Number(form.querySelector('#travelpace-distance')?.value) || 0 };
    return {
      mode,
      pace,
      mount,
      time: { days: Number(form.querySelector('#travelpace-days')?.value) || 0, hours: Number(form.querySelector('#travelpace-hours')?.value) || 0, minutes: 0 }
    };
  }

  /**
   * Whether a payload carries enough input to calculate anything.
   * @param {object} data A payload from #getFormData
   * @returns {boolean} True when the form has usable input
   */
  static #hasInput(data) {
    return data.mode === 'distance' ? data.distance > 0 : data.time.days > 0 || data.time.hours > 0;
  }

  /**
   * Action handler: post the calculation to chat.
   * @this {TravelPaceApp}
   * @returns {Promise<void>}
   */
  static async #submitCalculation() {
    const data = this.#getFormData();
    if (!TravelPaceApp.#hasInput(data)) {
      ui.notifications.warn('TRAVELPACE.Preview.Error');
      return;
    }
    await TravelCalculator.submitCalculation(data);
  }

  /** Recompute and render the live preview line. */
  #updatePreview() {
    const preview = this.element.querySelector('.calculation-preview');
    if (!preview) return;
    const data = this.#getFormData();
    const result = TravelPaceApp.#hasInput(data) ? TravelCalculator.calculateTravel(data) : null;
    if (!result) {
      preview.textContent = _loc('TRAVELPACE.Preview.Empty');
      return;
    }
    preview.textContent = result.mode === 'distance' ? result.output.timeFormatted : `${result.output.distance.toFixed(1)} ${result.output.unit}`;
  }

  /** Show the speed the selected pace and mount imply, beside the pace label. */
  #updatePaceLabel() {
    const label = this.element.querySelector('label[for="travelpace-pace"]');
    const pace = this.element.querySelector('#travelpace-pace')?.value;
    if (!label || !pace) return;
    label.textContent = `${_loc('TRAVELPACE.Labels.Pace')} (${formatMountSpeed(getMountSpeed(this.#selectedMount()), pace)})`;
  }

  /**
   * Resolve the enabled mounts and cache them, so the preview and pace label can read one synchronously.
   * @returns {Promise<Array<{uuid: string, name: string}>>} Mount options for the dropdown
   */
  async #loadMounts() {
    this.#mounts.clear();
    const options = [];
    for (const uuid of getEnabledMountUuids()) {
      const actor = await resolveMount(uuid);
      if (!actor) continue;
      this.#mounts.set(uuid, actor);
      options.push({ uuid, name: actor.name });
    }
    return options;
  }

  /**
   * The mount currently chosen in the dropdown.
   * @returns {foundry.documents.Actor|null} The resolved mount, or null when none is selected
   */
  #selectedMount() {
    const uuid = this.element.querySelector('#travelpace-mount')?.value;
    return (uuid && this.#mounts.get(uuid)) || null;
  }
}
