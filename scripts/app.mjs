import { CONST } from './config.mjs';
import { formatMountSpeed, getMountSpeed, resolveMount } from './helpers.mjs';
import { TravelCalculator } from './travel-calculator.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Main application for the Travel Pace calculator. */
export class TravelPaceApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static PARTS = { main: { template: 'modules/travel-pace/templates/calculator.hbs' } };

  static DEFAULT_OPTIONS = {
    id: 'travel-pace-calculator',
    classes: ['travel-calculator-window'],
    position: { height: 'auto', width: 300, top: 74, left: 120 },
    actions: { submitCalculation: TravelPaceApp.#submitCalculation },
    window: { icon: 'fa-solid fa-route', title: 'TravelPace.Title', resizable: false, minimizable: true }
  };

  /** @type {Map<string, foundry.documents.Actor>} Resolved mounts, keyed by the value their option carries. */
  #mounts = new Map();

  /** @inheritdoc */
  async _prepareContext() {
    const useMetric = game.settings.get(CONST.moduleId, CONST.settings.useMetric);
    const mounts = await this.#loadMounts();
    const speeds = TravelPaceApp.#getDefaultSpeeds(useMetric);
    return {
      units: { distance: useMetric ? _loc('DND5E.DistKmAbbr') : _loc('DND5E.DistMiAbbr') },
      modes: [
        { id: 'distance', label: 'TravelPace.Modes.Distance' },
        { id: 'time', label: 'TravelPace.Modes.Time' }
      ],
      paces: [
        { id: 'normal', label: 'TravelPace.Paces.Normal', speed: speeds.normal },
        { id: 'fast', label: 'TravelPace.Paces.Fast', speed: speeds.fast },
        { id: 'slow', label: 'TravelPace.Paces.Slow', speed: speeds.slow }
      ],
      mounts,
      hasMounts: mounts.length > 0
    };
  }

  /** @type {number|null} Hook id for the Calendaria weather listener */
  #weatherHookId = null;

  /** @inheritdoc */
  _onRender(_context, _options) {
    this.element.addEventListener('input', this.#onInputChange.bind(this));
    this.#setMode('distance');
    this.#updatePreview();
    this.#updatePaceLabel();
    this.#weatherHookId ??= Hooks.on('calendaria.weatherChange', () => this.#updatePreview());
  }

  /** @inheritdoc */
  _onClose(options) {
    super._onClose(options);
    if (this.#weatherHookId) Hooks.off('calendaria.weatherChange', this.#weatherHookId);
    this.#weatherHookId = null;
    if (TravelCalculator.requestor === this) TravelCalculator.requestor = undefined;
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
   * Toggle visibility of the two calculation-mode panels.
   * @param {string} mode 'distance' or 'time'
   */
  #setMode(mode) {
    const distanceGroup = this.element.querySelector('.distance-to-time');
    const timeGroup = this.element.querySelector('.time-to-distance');
    if (distanceGroup) distanceGroup.style.display = mode === 'distance' ? 'block' : 'none';
    if (timeGroup) timeGroup.style.display = mode === 'distance' ? 'none' : 'block';
  }

  /**
   * Action handler: submit the calculation and post results to chat.
   * @this {TravelPaceApp}
   * @returns {Promise<void>}
   */
  static async #submitCalculation() {
    const container = this.element;
    const mode = container.querySelector('input[name="travelpace-mode"]:checked')?.value;
    const pace = container.querySelector('#travelpace-pace')?.value;
    const mount = this.#selectedMount();
    let data;
    if (mode === 'distance') {
      const distance = Number(container.querySelector('#travelpace-distance')?.value);
      data = { mode, distance, pace, mount };
    } else {
      const days = Number(container.querySelector('#travelpace-days')?.value);
      const hours = Number(container.querySelector('#travelpace-hours')?.value);
      data = { mode, time: { days, hours, minutes: 0 }, pace, mount };
    }
    await TravelCalculator.submitCalculation(data);
  }

  /** Recompute and render the live preview line. */
  #updatePreview() {
    const previewEl = this.element.querySelector('.calculation-preview');
    if (!previewEl) return;
    const mode = this.element.querySelector('input[name="travelpace-mode"]:checked')?.value;
    const pace = this.element.querySelector('#travelpace-pace')?.value;
    const mount = this.#selectedMount();
    const preview = mode === 'distance' ? this.#getDistancePreview(pace, mount) : this.#getTimePreview(pace, mount);
    previewEl.textContent = preview || _loc('TravelPace.Preview.Empty');
  }

  /**
   * Preview text for distance → time mode.
   * @param {string} pace Selected travel pace id
   * @param {foundry.documents.Actor|null} mount Selected mount
   * @returns {string} Formatted travel-time string, or empty if no input
   */
  #getDistancePreview(pace, mount) {
    const distance = Number(this.element.querySelector('#travelpace-distance')?.value);
    if (!distance || distance <= 0) return '';
    return TravelCalculator.calculateTravel({ mode: 'distance', distance, pace, mount })?.output.timeFormatted ?? '';
  }

  /**
   * Preview text for time → distance mode.
   * @param {string} pace Selected travel pace id
   * @param {foundry.documents.Actor|null} mount Selected mount
   * @returns {string} Formatted distance string, or empty if no input
   */
  #getTimePreview(pace, mount) {
    const days = Number(this.element.querySelector('#travelpace-days')?.value || 0);
    const hours = Number(this.element.querySelector('#travelpace-hours')?.value || 0);
    if (days <= 0 && hours <= 0) return '';
    const result = TravelCalculator.calculateTravel({ mode: 'time', time: { days, hours, minutes: 0 }, pace, mount });
    if (!result) return '';
    const useMetric = game.settings.get(CONST.moduleId, CONST.settings.useMetric);
    const unit = useMetric ? _loc('DND5E.DistKmAbbr') : _loc('DND5E.DistMiAbbr');
    return `${result.output.distance.toFixed(1)} ${unit}`;
  }

  /**
   * Resolve the localized default pace-speed strings for the chosen unit system.
   * @param {boolean} useMetric Whether to render metric units
   * @returns {{fast: string, normal: string, slow: string}} Localized default speed strings
   */
  static #getDefaultSpeeds(useMetric) {
    const suffix = useMetric ? 'Metric' : 'Imperial';
    return {
      fast: _loc(`TravelPace.Speed.Default.Fast.${suffix}`),
      normal: _loc(`TravelPace.Speed.Default.Normal.${suffix}`),
      slow: _loc(`TravelPace.Speed.Default.Slow.${suffix}`)
    };
  }

  /**
   * Resolve the enabled mounts and cache them.
   * @returns {Promise<Array<{id: string, name: string}>>} Mount options for the dropdown
   */
  async #loadMounts() {
    const enabledMounts = game.settings.get(CONST.moduleId, CONST.settings.enabledMounts) || {};
    this.#mounts.clear();
    const options = [];
    for (const [key, enabled] of Object.entries(enabledMounts)) {
      if (!enabled) continue;
      const actor = await resolveMount(key);
      if (!actor) continue;
      this.#mounts.set(key, actor);
      options.push({ id: key, name: actor.name });
    }
    return options;
  }

  /**
   * The mount currently chosen in the dropdown.
   * @returns {foundry.documents.Actor|null} The resolved mount, or null when none is selected
   */
  #selectedMount() {
    const key = this.element.querySelector('#travelpace-mount')?.value;
    return (key && this.#mounts.get(key)) || null;
  }

  /** Update the pace label with the speed implied by the selected pace and mount. */
  #updatePaceLabel() {
    const paceLabel = this.element.querySelector('label[for="travelpace-pace"]');
    const paceSelect = this.element.querySelector('#travelpace-pace');
    if (!paceLabel || !paceSelect) return;

    const pace = paceSelect.value;
    const mount = this.#selectedMount();
    const useMetric = game.settings.get(CONST.moduleId, CONST.settings.useMetric);
    const speed = mount ? formatMountSpeed(getMountSpeed(mount), pace, useMetric) : TravelPaceApp.#getDefaultSpeeds(useMetric)[pace];
    paceLabel.textContent = `${_loc('TravelPace.Labels.Pace')} (${speed})`;
  }
}
