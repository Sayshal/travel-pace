import { CONST } from './config.js';
import { TravelCalculator } from './travel-calculator.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Main application for the Travel Pace calculator
 * @class
 * @extends {HandlebarsApplicationMixin(ApplicationV2)}
 */
export class TravelPaceApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static PARTS = {
    main: { template: 'modules/travel-pace/templates/calculator.hbs' }
  };

  static DEFAULT_OPTIONS = {
    id: 'travel-pace-calculator',
    title: 'TravelPace.Title',
    classes: ['travel-calculator-window'],
    position: { height: 'auto', width: 300, top: 74, left: 120 },
    resizable: true,
    actions: {
      submitCalculation: TravelPaceApp.#submitCalculation
    },
    window: { icon: 'fa-solid fa-route', resizable: false, minimizable: true }
  };

  /**
   * Application constructor
   * @param {Object} options - Application options
   */
  constructor(options = {}) {
    super(options);
    this.mounts = [];
  }

  /**
   * Get the application title
   * @returns {string} Localized title
   */
  get title() {
    return game.i18n.localize('TravelPace.Title');
  }

  /**
   * Prepare data for the template context
   * @returns {Promise<Object>} - The template context
   * @protected
   */
  async _prepareContext() {
    try {
      const enabledMounts = game.settings.get(CONST.moduleId, CONST.settings.enabledMounts) || {};
      const useMetric = game.settings.get(CONST.moduleId, CONST.settings.useMetric);
      console.log('TravelPace | Enabled mounts setting:', enabledMounts);
      const mounts = await TravelPaceApp.#getAvailableMounts(enabledMounts, useMetric);
      console.log('TravelPace | Available mounts:', mounts);
      const speedUnit = useMetric ? game.i18n.localize('DND5E.DistMAbbr') : game.i18n.localize('DND5E.DistFtAbbr');
      const speeds = {
        fast: useMetric ? game.i18n.localize('TravelPace.Speed.Default.Fast.Metric') : game.i18n.localize('TravelPace.Speed.Default.Fast.Imperial'),
        normal: useMetric ? game.i18n.localize('TravelPace.Speed.Default.Normal.Metric') : game.i18n.localize('TravelPace.Speed.Default.Normal.Imperial'),
        slow: useMetric ? game.i18n.localize('TravelPace.Speed.Default.Slow.Metric') : game.i18n.localize('TravelPace.Speed.Default.Slow.Imperial')
      };
      return {
        useMetric,
        units: {
          distance: useMetric ? game.i18n.localize('DND5E.DistKmAbbr') : game.i18n.localize('DND5E.DistMiAbbr'),
          speed: speedUnit
        },
        speeds,
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
    } catch (error) {
      console.error('TravelPace | Error preparing context:', error);
      const useMetric = false;
      return {
        useMetric,
        units: {
          distance: game.i18n.localize('DND5E.DistMiAbbr'),
          speed: game.i18n.localize('DND5E.DistFtAbbr')
        },
        speeds: {
          fast: game.i18n.localize('TravelPace.Speed.Default.Fast.Imperial'),
          normal: game.i18n.localize('TravelPace.Speed.Default.Normal.Imperial'),
          slow: game.i18n.localize('TravelPace.Speed.Default.Slow.Imperial')
        },
        modes: [],
        paces: [],
        mounts: [],
        hasMounts: false
      };
    }
  }

  /**
   * Setup after render
   * @param {Object} context - Application context
   * @param {Object} options - Render options
   * @protected
   */
  _onRender(context, options) {
    try {
      this.#setupEventListeners();
      this.#setupInitialMode();
      this.#updatePreview();
      this.mounts = context.mounts || [];
      TravelPaceApp.#updatePaceLabel(this);
    } catch (error) {
      console.error('TravelPace | Error in onRender:', error);
    }
  }

  /**
   * Clean up when the application is closed
   * @param {Object} options - Closing options
   * @protected
   */
  _onClose(options) {
    super._onClose(options);
    if (TravelCalculator.requestor === this) TravelCalculator.requestor = undefined;
    if (!canvas?.ready || !ui?.controls) return;
    if (ui.controls.control?.name === 'tokens' && ui.controls.tool?.name === 'travel-pace') ui.controls.activate({ control: 'tokens', tool: 'select' });
  }

  /**
   * Set up event listeners for the calculator form
   * @private
   */
  #setupEventListeners() {
    if (!this.element) return;
    this.element.addEventListener('input', (event) => {
      this.#handleInputChange(event);
    });
    this.element.addEventListener('change', (event) => {
      this.#handleInputChange(event);
    });
  }

  /**
   * Handle input or change events for any form control
   * @param {Event} event - The input or change event
   * @private
   */
  #handleInputChange(event) {
    try {
      if (event.target.name === 'travelpace-mode') this.#setupMode(event.target.value);
      else if (event.target.id === 'travelpace-pace') TravelPaceApp.#updatePaceLabel(this);
      else if (event.target.id === 'travelpace-mount') TravelPaceApp.#updatePaceLabel(this);
      this.#updatePreview();
    } catch (error) {
      console.error('TravelPace | Error handling input change:', error);
    }
  }

  /**
   * Set up the initial calculation mode
   * @private
   */
  #setupInitialMode() {
    this.#setupMode('distance');
  }

  /**
   * Set up the calculator for a specific mode
   * @param {string} mode - The calculation mode ('distance' or 'time')
   * @private
   */
  #setupMode(mode) {
    const container = this.element;
    if (!container) return;
    const distanceGroup = container.querySelector('.distance-to-time');
    const timeGroup = container.querySelector('.time-to-distance');
    if (mode === 'distance') {
      if (distanceGroup) distanceGroup.style.display = 'block';
      if (timeGroup) timeGroup.style.display = 'none';
    } else {
      if (distanceGroup) distanceGroup.style.display = 'none';
      if (timeGroup) timeGroup.style.display = 'block';
    }
  }

  /**
   * Submit the calculation and send results to chat
   * @param {Event} event - The submit event
   * @param {HTMLElement} target - The submit button
   * @private
   * @static
   */
  static async #submitCalculation(event, target) {
    try {
      const app = target.closest('[data-application-id]');
      if (!app) return;
      const appInstance = ui.windows[app.dataset.applicationId];
      if (!appInstance) return;
      const container = appInstance.element;
      if (!container) return;
      const mode = container.querySelector('input[name="travelpace-mode"]:checked')?.value;
      const pace = container.querySelector('#travelpace-pace')?.value;
      const mountId = container.querySelector('#travelpace-mount')?.value;
      let data;
      if (mode === 'distance') {
        const distance = Number(container.querySelector('#travelpace-distance')?.value);
        const useMetric = game.settings.get(CONST.moduleId, CONST.settings.useMetric);
        const unit = useMetric ? game.i18n.localize('DND5E.DistKmAbbr') : game.i18n.localize('DND5E.DistMiAbbr');
        data = { mode, distance, unit, pace, mountId };
      } else {
        const days = Number(container.querySelector('#travelpace-days')?.value);
        const hours = Number(container.querySelector('#travelpace-hours')?.value);
        const minutes = 0;
        data = { mode, time: { days, hours, minutes }, pace, mountId };
      }
      const result = await TravelCalculator.submitCalculation(data);
      if (result) console.log('TravelPace | Calculation submitted successfully');
    } catch (error) {
      console.error('TravelPace | Error submitting calculation:', error);
      ui.notifications.error(game.i18n.localize('TravelPace.Errors.CalculationFailed'));
    }
  }

  /**
   * Update the calculation preview
   * @private
   */
  #updatePreview() {
    try {
      const container = this.element;
      if (!container) return;
      const previewEl = container.querySelector('.calculation-preview');
      if (!previewEl) return;
      const mode = container.querySelector('input[name="travelpace-mode"]:checked')?.value;
      const pace = container.querySelector('#travelpace-pace')?.value;
      const mountId = container.querySelector('#travelpace-mount')?.value;
      let preview;
      if (mode === 'distance') preview = this.#getDistancePreview(container, pace, mountId);
      else preview = this.#getTimePreview(container, pace, mountId);
      previewEl.textContent = preview || game.i18n.localize('TravelPace.Preview.Empty');
    } catch (error) {
      console.error('TravelPace | Error updating preview:', error);
      const previewEl = this.element?.querySelector('.calculation-preview');
      if (previewEl) previewEl.textContent = game.i18n.localize('TravelPace.Preview.Error');
    }
  }

  /**
   * Get preview text for distance to time calculation
   * @param {HTMLElement} container - The calculator container
   * @param {string} pace - The selected pace
   * @param {string} mountId - The selected mount ID
   * @returns {string} - The preview text
   * @private
   */
  #getDistancePreview(container, pace, mountId) {
    const distanceInput = container.querySelector('#travelpace-distance');
    if (!distanceInput) return '';
    const distance = Number(distanceInput.value);
    if (distance <= 0) return '';
    const data = { mode: 'distance', distance, pace, mountId };
    const result = TravelCalculator.calculateTravel(data);
    return result.output.timeFormatted;
  }

  /**
   * Get preview text for time to distance calculation
   * @param {HTMLElement} container - The calculator container
   * @param {string} pace - The selected pace
   * @param {string} mountId - The selected mount ID
   * @returns {string} - The preview text
   * @private
   */
  #getTimePreview(container, pace, mountId) {
    const daysInput = container.querySelector('#travelpace-days');
    const hoursInput = container.querySelector('#travelpace-hours');
    if (!daysInput || !hoursInput) return '';
    const days = Number(daysInput.value || 0);
    const hours = Number(hoursInput.value || 0);
    if (days <= 0 && hours <= 0) return '';
    const data = { mode: 'time', time: { days, hours, minutes: 0 }, pace, mountId };
    const result = TravelCalculator.calculateTravel(data);
    const useMetric = game.settings.get(CONST.moduleId, CONST.settings.useMetric);
    const unit = useMetric ? game.i18n.localize('DND5E.DistKmAbbr') : game.i18n.localize('DND5E.DistMiAbbr');
    return `${result.output.distance.toFixed(1)} ${unit}`;
  }

  /**
   * Get available mounts from enabled mounts config
   * @param {Object} enabledMounts - Enabled mounts configuration
   * @param {boolean} useMetric - Whether to use metric units
   * @returns {Promise<Array>} - Array of available mounts
   * @private
   */
  static async #getAvailableMounts(enabledMounts, useMetric) {
    const mounts = [];
    for (const id in enabledMounts) {
      if (!enabledMounts[id]) continue;
      try {
        let actor;
        if (id.includes('.')) actor = await fromUuid(id);
        else actor = game.actors.get(id);
        if (actor) {
          const speed = await TravelPaceApp.#getMountSpeed(id, useMetric);
          mounts.push({ id: actor.id, name: actor.name, speed });
        }
      } catch (error) {
        console.error('TravelPace | Error getting mount:', error);
      }
    }
    return mounts;
  }

  /**
   * Get the speed text for a mount
   * @param {string} mountId - The mount ID
   * @param {boolean} useMetric - Whether to use metric units
   * @returns {Promise<string>} - The speed text
   * @private
   */
  static async #getMountSpeed(mountId, useMetric) {
    try {
      let actor;
      if (mountId.includes('.')) actor = await fromUuid(mountId);
      else actor = game.actors.get(mountId);
      if (!actor) return '';
      if (actor.type === 'vehicle') {
        const movement = actor.system.attributes?.movement || {};
        const miAbbrev = game.i18n.localize('DND5E.DistMiAbbr');
        const kmAbbrev = game.i18n.localize('DND5E.DistKmAbbr');
        if (movement.units === miAbbrev || movement.units === kmAbbrev) {
          const speeds = Object.entries(movement)
            .filter(([key, value]) => typeof value === 'number' && key !== 'units')
            .map(([key, value]) => value);
          if (speeds.length) {
            const maxSpeed = Math.max(...speeds);
            const unit = movement.units === miAbbrev ? miAbbrev : kmAbbrev;
            return game.i18n.format('TravelPace.Speed.Format.PerHour', { speed: maxSpeed, unit });
          }
        }
      }
      const walkSpeed = actor.system.attributes?.movement?.walk || 30;
      const baseSpeed = useMetric ? Math.round(walkSpeed * CONST.conversion.mPerFt) : walkSpeed;
      const unit = useMetric ? game.i18n.localize('DND5E.DistMAbbr') : game.i18n.localize('DND5E.DistFtAbbr');
      return game.i18n.format('TravelPace.Speed.Format.PerMinute', { speed: baseSpeed, unit });
    } catch (error) {
      console.error('TravelPace | Error getting mount speed:', error);
      return '';
    }
  }

  /**
   * Update the pace label with current speed information
   * @param {TravelPaceApp} app - The application instance
   * @private
   */
  static #updatePaceLabel(app) {
    try {
      const container = app.element;
      if (!container) return;
      const paceLabel = container.querySelector('label[for="travelpace-pace"]');
      const paceSelect = container.querySelector('#travelpace-pace');
      const mountSelect = container.querySelector('#travelpace-mount');
      if (!paceLabel || !paceSelect) return;
      const pace = paceSelect.value;
      const useMetric = game.settings.get(CONST.moduleId, CONST.settings.useMetric);
      const footSpeeds = {
        fast: useMetric ? game.i18n.localize('TravelPace.Speed.Default.Fast.Metric') : game.i18n.localize('TravelPace.Speed.Default.Fast.Imperial'),
        normal: useMetric ? game.i18n.localize('TravelPace.Speed.Default.Normal.Metric') : game.i18n.localize('TravelPace.Speed.Default.Normal.Imperial'),
        slow: useMetric ? game.i18n.localize('TravelPace.Speed.Default.Slow.Metric') : game.i18n.localize('TravelPace.Speed.Default.Slow.Imperial')
      };
      let speedText = footSpeeds[pace];
      if (mountSelect?.value) {
        TravelPaceApp.#updateMountSpeedLabel(paceLabel, mountSelect.value, pace);
        return;
      }
      paceLabel.innerHTML = `${game.i18n.localize('TravelPace.Labels.Pace')} (${speedText})`;
    } catch (error) {
      console.error('TravelPace | Error updating pace label:', error);
    }
  }

  /**
   * Update the pace label with mount speed
   * @param {HTMLElement} paceLabel - The pace label element
   * @param {string} mountId - The mount ID
   * @param {string} pace - The selected pace
   * @private
   */
  static async #updateMountSpeedLabel(paceLabel, mountId, pace) {
    try {
      const useMetric = game.settings.get(CONST.moduleId, CONST.settings.useMetric);
      const mountSpeed = await TravelPaceApp.#getMountSpeed(mountId, useMetric);
      if (!mountSpeed) {
        const defaultSpeed = useMetric ? game.i18n.localize('TravelPace.Speed.Default.Normal.Metric') : game.i18n.localize('TravelPace.Speed.Default.Normal.Imperial');
        paceLabel.innerHTML = `${game.i18n.localize('TravelPace.Labels.Pace')} (${defaultSpeed})`;
        return;
      }
      const multiplier = CONST.multipliers[pace];
      let adjustedSpeedText = '';
      // LOCALIZE
      if (mountSpeed.includes('/hour')) adjustedSpeedText = TravelPaceApp.#formatVehicleSpeed(mountSpeed, multiplier, useMetric);
      else adjustedSpeedText = TravelPaceApp.#formatWalkingSpeed(mountSpeed, multiplier, useMetric);
      paceLabel.innerHTML = `${game.i18n.localize('TravelPace.Labels.Pace')} (${adjustedSpeedText})`;
    } catch (error) {
      console.error('TravelPace | Error updating mount speed label:', error);
      paceLabel.innerHTML = game.i18n.localize('TravelPace.Labels.Pace');
    }
  }

  /**
   * Format vehicle speed with pace multiplier
   * @param {string} mountSpeed - The mount's speed
   * @param {number} multiplier - The pace multiplier
   * @param {boolean} useMetric - Whether to use metric units
   * @returns {string} - Formatted speed text
   * @private
   */
  static #formatVehicleSpeed(mountSpeed, multiplier, useMetric) {
    const hourUnit = game.i18n.localize('TravelPace.Speed.Units.Hour');
    const speedRegex = new RegExp(`^(\\d+(\\.\\d+)?)\\s*([^/]+)/${hourUnit}$`);
    const match = mountSpeed.match(speedRegex);
    if (!match) return mountSpeed;
    const speed = parseFloat(match[1]);
    const unit = match[3];
    const adjustedSpeed = (speed * multiplier).toFixed(1);
    return game.i18n.format('TravelPace.Speed.Format.PerHour', { speed: adjustedSpeed, unit });
  }

  /**
   * Format walking speed with pace multiplier
   * @param {string} mountSpeed - The mount's speed
   * @param {number} multiplier - The pace multiplier
   * @param {boolean} useMetric - Whether to use metric units
   * @returns {string} - Formatted speed text
   * @private
   */
  static #formatWalkingSpeed(mountSpeed, multiplier, useMetric) {
    const minUnit = game.i18n.localize('TravelPace.Speed.Units.Minute');
    const speedRegex = new RegExp(`^(\\d+(\\.\\d+)?)\\s*([^/]+)/${minUnit}$`);
    const match = mountSpeed.match(speedRegex);
    if (!match) return mountSpeed;
    const speed = parseFloat(match[1]);
    const unit = match[3];
    const adjustedSpeed = Math.round(speed * multiplier);
    return game.i18n.format('TravelPace.Speed.Format.PerMinute', { speed: adjustedSpeed, unit });
  }
}
