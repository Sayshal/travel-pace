import { MODULE, TEMPLATES } from '../constants.mjs';
import { TravelCalculator } from '../travel-calculator.mjs';
import { effectivePace, fastestTravelType, formatMountSpeed, getEnabledMountUuids, getTravellerSpeed, getTravellerSpeeds, resolveMount, travelUnits, unitAbbreviation } from '../utils.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { DragDrop, TextEditor } = foundry.applications.ux;

/** The travel calculator window. */
export class TravelPaceApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static PARTS = {
    mode: { template: TEMPLATES.MODE_TOGGLE },
    journey: { template: TEMPLATES.JOURNEY },
    traveller: { template: TEMPLATES.TRAVELLER },
    result: { template: TEMPLATES.RESULT },
    footer: { template: TEMPLATES.FORM_FOOTER }
  };

  static DEFAULT_OPTIONS = {
    id: MODULE.APP_ID,
    classes: ['travel-pace-app'],
    position: { height: 'auto', width: 360 },
    actions: {
      setMode: TravelPaceApp.#setMode,
      clearTraveller: TravelPaceApp.#clearTraveller,
      submitCalculation: TravelPaceApp.#submitCalculation
    },
    window: { icon: 'fa-solid fa-route', title: 'TRAVELPACE.Title', contentClasses: ['standard-form'], resizable: false }
  };

  /**
   * The form's state.
   * @type {{mode: string, pace: string, traveller: string, travelType: string, distance: number, days: number, hours: number}}
   */
  #state = { mode: 'distance', pace: 'normal', traveller: '', travelType: '', distance: 0, days: 0, hours: 0 };

  /** @type {Map<string, foundry.documents.Actor>} Travellers on offer, keyed by UUID. */
  #travellers = new Map();

  /** @type {Set<string>} UUIDs dropped onto the window this session, which the GM has not enabled. */
  #dropped = new Set();

  /** @type {number|null} Hook id for the Calendaria weather listener. */
  #weatherHookId = null;

  /** @type {DragDrop|null} */
  #dragDrop = null;

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
    const { mode, traveller } = this.#state;
    await this.#loadTravellers();

    const actor = this.#travellers.get(traveller) ?? null;
    const speeds = getTravellerSpeeds(actor);
    if (!(this.#state.travelType in speeds)) this.#state.travelType = fastestTravelType(speeds) ?? '';
    const speed = getTravellerSpeed(actor, this.#state.travelType);
    const pace = effectivePace(actor, this.#state.pace);

    return {
      distanceMode: mode === 'distance',
      modes: [
        { id: 'distance', label: 'ATLAS.Common.Distance', active: mode === 'distance' },
        { id: 'time', label: 'ATLAS.Common.Time', active: mode === 'time' }
      ],
      unit: unitAbbreviation(travelUnits().length),
      distance: this.#state.distance || null,
      days: this.#state.days,
      hours: this.#state.hours,
      paces: Object.entries(CONFIG.DND5E.travelPace).map(([id, { label }]) => ({ id, label, selected: id === this.#state.pace })),
      paceDisabled: !speed.paced,
      paceHint: _loc('TRAVELPACE.Hints.Pace', { speed: formatMountSpeed(speed, pace) }),
      paceNote: this.#describePaceNote(speed, pace),
      travelTypes: Object.keys(speeds).map((id) => ({ id, label: CONFIG.DND5E.travelTypes[id]?.label ?? id, selected: id === this.#state.travelType })),
      multipleTravelTypes: Object.keys(speeds).length > 1,
      traveller: actor ? { uuid: actor.uuid, name: actor.name, img: actor.img } : null,
      travellers: [...this.#travellers.values()].map((option) => ({ uuid: option.uuid, name: option.name, selected: option.uuid === traveller })),
      multipleTravellers: this.#travellers.size > 1,
      result: this.#describeResult(),
      buttons: [{ type: 'button', action: 'submitCalculation', icon: 'fas fa-comments', label: 'TRAVELPACE.Buttons.Calculate' }]
    };
  }

  /** @inheritdoc */
  _onFirstRender(_context, _options) {
    this.element.addEventListener('input', this.#onInputChange.bind(this));
    this.#weatherHookId = Hooks.on('calendaria.weatherChange', () => this.render());
  }

  /** @inheritdoc */
  _onRender(_context, _options) {
    this.#dragDrop ??= new DragDrop.implementation({
      dropSelector: '.traveller-drop',
      permissions: { drop: () => true },
      callbacks: { drop: this.#onDrop.bind(this) }
    });
    this.#dragDrop.bind(this.element);
  }

  /** @inheritdoc */
  _onClose(options) {
    super._onClose(options);
    if (this.#weatherHookId) Hooks.off('calendaria.weatherChange', this.#weatherHookId);
    this.#weatherHookId = null;
  }

  /**
   * Record a changed field and refresh the result line, without re-rendering under the cursor.
   * @param {Event} event Input event from the form
   * @returns {void}
   */
  #onInputChange(event) {
    const { name, value } = event.target;
    if (!(name in this.#state)) return;
    const isChoice = ['pace', 'traveller', 'travelType'].includes(name);
    this.#state[name] = isChoice ? value : Number(value) || 0;
    if (name === 'traveller') this.#state.travelType = '';
    if (isChoice) return void this.render();
    const line = this.element.querySelector('.travel-result');
    if (line) line.textContent = this.#describeResult();
  }

  /**
   * Take a dropped actor as the traveller, offering it alongside the GM's configured mounts.
   * @param {DragEvent} event The drop event
   * @returns {Promise<void>}
   */
  async #onDrop(event) {
    const data = TextEditor.implementation.getDragEventData(event);
    if (data?.type !== 'Actor') return;
    const actor = await fromUuid(data.uuid);
    if (!actor) return;
    this.#dropped.add(actor.uuid);
    this.#state.traveller = actor.uuid;
    this.#state.travelType = '';
    this.render();
  }

  /**
   * The calculator payload the current state describes.
   * @returns {object} A payload for TravelCalculator.calculateTravel
   */
  #getFormData() {
    const { mode, pace, traveller, travelType, distance, days, hours } = this.#state;
    const mount = this.#travellers.get(traveller) ?? null;
    return mode === 'distance' ? { mode, pace, travelType, mount, distance } : { mode, pace, travelType, mount, time: { days, hours, minutes: 0 } };
  }

  /**
   * Whether the form carries enough input to calculate anything.
   * @returns {boolean} True when there is something to calculate
   */
  #hasInput() {
    const { mode, distance, days, hours } = this.#state;
    return mode === 'distance' ? distance > 0 : days > 0 || hours > 0;
  }

  /**
   * The result line for the current state.
   * @returns {string} Localized result, or the empty-state prompt
   */
  #describeResult() {
    if (!this.#hasInput()) return _loc('TRAVELPACE.Preview.Empty');
    const result = TravelCalculator.calculateTravel(this.#getFormData());
    if (!result) return _loc('TRAVELPACE.Preview.Empty');
    return result.mode === 'distance' ? result.output.timeFormatted : `${result.output.distance.toFixed(1)} ${result.output.unit}`;
  }

  /**
   * Why the pace in use differs from the one chosen, if it does.
   * @param {object} speed The traveller's speed, as read by getTravellerSpeed
   * @param {string} pace The pace the traveller actually moves at
   * @returns {string|null} Localized note, or null when the chosen pace applies
   */
  #describePaceNote(speed, pace) {
    if (!speed.paced) return _loc('TRAVELPACE.Hints.Unpaced');
    if (pace !== this.#state.pace) return _loc('DND5E.TRAVEL.Slowed.Group');
    return null;
  }

  /**
   * Resolve every traveller on offer: the mounts the GM enabled, plus anything dropped this session.
   * @returns {Promise<void>}
   */
  async #loadTravellers() {
    this.#travellers.clear();
    for (const uuid of [...getEnabledMountUuids(), ...this.#dropped]) {
      const actor = await resolveMount(uuid);
      if (actor) this.#travellers.set(uuid, actor);
    }
  }

  /**
   * Action handler: switch which quantity the calculator solves for.
   * @this {TravelPaceApp}
   * @param {Event} _event Triggering event
   * @param {HTMLElement} target The clicked half of the toggle
   * @returns {void}
   */
  static #setMode(_event, target) {
    this.#state.mode = target.dataset.mode;
    this.render();
  }

  /**
   * Action handler: travel on foot again.
   * @this {TravelPaceApp}
   * @returns {void}
   */
  static #clearTraveller() {
    this.#state.traveller = '';
    this.#state.travelType = '';
    this.render();
  }

  /**
   * Action handler: post the calculation to chat.
   * @this {TravelPaceApp}
   * @returns {Promise<void>}
   */
  static async #submitCalculation() {
    if (!this.#hasInput()) {
      ui.notifications.warn('TRAVELPACE.Preview.Error', { localize: true });
      return;
    }
    await TravelCalculator.submitCalculation(this.#getFormData());
  }
}
