import { CONST } from './config.mjs';
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

  /** @inheritdoc */
  async _prepareContext() {
    const enabledMounts = game.settings.get(CONST.moduleId, CONST.settings.enabledMounts) || {};
    const useMetric = game.settings.get(CONST.moduleId, CONST.settings.useMetric);
    const mounts = await TravelPaceApp.#getAvailableMounts(enabledMounts);
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

  /** @inheritdoc */
  _onRender(_context, _options) {
    this.element.addEventListener('input', this.#onInputChange.bind(this));
    this.element.addEventListener('change', this.#onInputChange.bind(this));
    this.#setMode('distance');
    this.#updatePreview();
    this.#updatePaceLabel();
  }

  /** @inheritdoc */
  _onClose(options) {
    super._onClose(options);
    if (TravelCalculator.requestor === this) TravelCalculator.requestor = undefined;
  }

  /**
   * Dispatch form input/change events to the right update path.
   * @param {Event} event Input or change event from the calculator form
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
    const mountId = container.querySelector('#travelpace-mount')?.value;
    let data;
    if (mode === 'distance') {
      const distance = Number(container.querySelector('#travelpace-distance')?.value);
      data = { mode, distance, pace, mountId };
    } else {
      const days = Number(container.querySelector('#travelpace-days')?.value);
      const hours = Number(container.querySelector('#travelpace-hours')?.value);
      data = { mode, time: { days, hours, minutes: 0 }, pace, mountId };
    }
    await TravelCalculator.submitCalculation(data);
  }

  /** Recompute and render the live preview line. */
  #updatePreview() {
    const previewEl = this.element.querySelector('.calculation-preview');
    if (!previewEl) return;
    const mode = this.element.querySelector('input[name="travelpace-mode"]:checked')?.value;
    const pace = this.element.querySelector('#travelpace-pace')?.value;
    const mountId = this.element.querySelector('#travelpace-mount')?.value;
    const preview = mode === 'distance' ? this.#getDistancePreview(pace, mountId) : this.#getTimePreview(pace, mountId);
    previewEl.textContent = preview || _loc('TravelPace.Preview.Empty');
  }

  /**
   * Preview text for distance → time mode.
   * @param {string} pace Selected travel pace id
   * @param {string} mountId Selected mount id (or empty)
   * @returns {string} Formatted travel-time string, or empty if no input
   */
  #getDistancePreview(pace, mountId) {
    const distance = Number(this.element.querySelector('#travelpace-distance')?.value);
    if (!distance || distance <= 0) return '';
    return TravelCalculator.calculateTravel({ mode: 'distance', distance, pace, mountId }).output.timeFormatted;
  }

  /**
   * Preview text for time → distance mode.
   * @param {string} pace Selected travel pace id
   * @param {string} mountId Selected mount id (or empty)
   * @returns {string} Formatted distance string, or empty if no input
   */
  #getTimePreview(pace, mountId) {
    const days = Number(this.element.querySelector('#travelpace-days')?.value || 0);
    const hours = Number(this.element.querySelector('#travelpace-hours')?.value || 0);
    if (days <= 0 && hours <= 0) return '';
    const result = TravelCalculator.calculateTravel({ mode: 'time', time: { days, hours, minutes: 0 }, pace, mountId });
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
   * Build the list of available mount options for the calculator dropdown.
   * @param {object<string, boolean>} enabledMounts Enabled-mount toggle map keyed by id/uuid
   * @returns {Promise<Array<{id: string, name: string}>>} Resolved mount option list
   */
  static async #getAvailableMounts(enabledMounts) {
    const mounts = [];
    for (const id in enabledMounts) {
      if (!enabledMounts[id]) continue;
      const actor = id.includes('.') ? await fromUuid(id) : game.actors.get(id);
      if (!actor) continue;
      mounts.push({ id: actor.id, name: actor.name });
    }
    return mounts;
  }

  /**
   * Format an actor's movement speed for display.
   * @param {foundry.documents.Actor} actor The mount or vehicle actor
   * @param {boolean} useMetric Whether to render distances in metric units
   * @returns {string} Localized speed string ("X ft/min" or "X mi/hour")
   */
  static #getMountSpeed(actor, useMetric) {
    if (actor.type === 'vehicle') {
      const movement = actor.system.attributes?.movement || {};
      const miAbbrev = _loc('DND5E.DistMiAbbr');
      const kmAbbrev = _loc('DND5E.DistKmAbbr');
      if (movement.units === miAbbrev || movement.units === kmAbbrev) {
        const speeds = Object.entries(movement)
          .filter(([key, value]) => typeof value === 'number' && key !== 'units')
          .map(([, value]) => value);
        if (speeds.length) {
          const unit = movement.units === miAbbrev ? miAbbrev : kmAbbrev;
          return _loc('TravelPace.Speed.Format.PerHour', { speed: Math.max(...speeds), unit });
        }
      }
    }
    const walkSpeed = actor.system.attributes?.movement?.walk || 30;
    const baseSpeed = useMetric ? Math.round(walkSpeed * CONST.conversion.mPerFt) : walkSpeed;
    const unit = useMetric ? _loc('DND5E.DistMAbbr') : _loc('DND5E.DistFtAbbr');
    return _loc('TravelPace.Speed.Format.PerMinute', { speed: baseSpeed, unit });
  }

  /** Update the pace label with the speed implied by the selected pace and mount. */
  async #updatePaceLabel() {
    const paceLabel = this.element.querySelector('label[for="travelpace-pace"]');
    const paceSelect = this.element.querySelector('#travelpace-pace');
    if (!paceLabel || !paceSelect) return;
    const pace = paceSelect.value;
    const mountId = this.element.querySelector('#travelpace-mount')?.value;
    const useMetric = game.settings.get(CONST.moduleId, CONST.settings.useMetric);
    const baseLabel = _loc('TravelPace.Labels.Pace');
    if (mountId) {
      const actor = mountId.includes('.') ? await fromUuid(mountId) : game.actors.get(mountId);
      if (actor) {
        const mountSpeed = TravelPaceApp.#getMountSpeed(actor, useMetric);
        const adjusted = TravelPaceApp.#applyPaceMultiplier(mountSpeed, CONST.multipliers[pace]);
        paceLabel.textContent = `${baseLabel} (${adjusted})`;
        return;
      }
    }
    const speeds = TravelPaceApp.#getDefaultSpeeds(useMetric);
    paceLabel.textContent = `${baseLabel} (${speeds[pace]})`;
  }

  /**
   * Apply a pace multiplier to a formatted speed string, preserving its hour/minute unit.
   * @param {string} speedString Formatted speed (e.g. "30 mi/hour" or "300 ft/min")
   * @param {number} multiplier Pace multiplier (e.g. 1.33 for fast)
   * @returns {string} The formatted speed string with the multiplier applied
   */
  static #applyPaceMultiplier(speedString, multiplier) {
    const hourUnit = _loc('TravelPace.Speed.Units.Hour');
    const minUnit = _loc('TravelPace.Speed.Units.Minute');
    const hourMatch = speedString.match(new RegExp(`^(\\d+(\\.\\d+)?)\\s*([^/]+)/${hourUnit}$`));
    if (hourMatch) {
      const adjusted = (parseFloat(hourMatch[1]) * multiplier).toFixed(1);
      return _loc('TravelPace.Speed.Format.PerHour', { speed: adjusted, unit: hourMatch[3] });
    }
    const minMatch = speedString.match(new RegExp(`^(\\d+(\\.\\d+)?)\\s*([^/]+)/${minUnit}$`));
    if (minMatch) {
      const adjusted = Math.round(parseFloat(minMatch[1]) * multiplier);
      return _loc('TravelPace.Speed.Format.PerMinute', { speed: adjusted, unit: minMatch[3] });
    }
    return speedString;
  }
}
