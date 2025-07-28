import { CONST } from './config.js';
import { TravelCalculator } from './travel-calculator.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Main application for the Travel Pace calculator
 * @class
 * @extends {HandlebarsApplicationMixin(ApplicationV2)}
 */
export class TravelPaceApp extends HandlebarsApplicationMixin(ApplicationV2) {
  // Define the Handlebars template parts
  static PARTS = {
    main: {
      template: 'modules/travel-pace/templates/calculator.hbs'
    }
  };

  // Application configuration
  static DEFAULT_OPTIONS = {
    id: 'travel-pace-calculator',
    title: 'TravelPace.Title',
    classes: ['travel-calculator-window'],
    position: {
      height: 'auto',
      width: 300,
      top: 74,
      left: 120
    },
    resizable: true,
    actions: {
      submitCalculation: TravelPaceApp.#submitCalculation
    },
    window: {
      icon: 'fa-solid fa-route',
      resizable: false,
      minimizable: true
    }
  };

  /**
   * Application constructor
   * @param {Object} options - Application options
   */
  constructor(options = {}) {
    super(options);

    // Store mount data for reference
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
      // Get settings
      const enabledMounts = game.settings.get(CONST.moduleId, CONST.settings.enabledMounts) || {};
      const useMetric = game.settings.get(CONST.moduleId, CONST.settings.useMetric);
      console.log('TravelPace | Enabled mounts setting:', enabledMounts);
      // Get mounted actors with their speeds
      const mounts = await TravelPaceApp.#getAvailableMounts(enabledMounts, useMetric);
      console.log('TravelPace | Available mounts:', mounts);
      // Get default speeds in appropriate units
      const speedUnit = useMetric ? 'm' : 'ft';
      const speeds = {
        fast: useMetric ? '133 m/min' : '400 ft/min',
        normal: useMetric ? '100 m/min' : '300 ft/min',
        slow: useMetric ? '67 m/min' : '200 ft/min'
      };

      // Prepare context data
      return {
        useMetric,
        units: {
          distance: useMetric ? 'km' : 'mi',
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
      return {
        useMetric: false,
        units: { distance: 'mi', speed: 'ft' },
        speeds: { fast: '400 ft/min', normal: '300 ft/min', slow: '200 ft/min' },
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
      // Set up form event listeners
      this.#setupEventListeners();

      // Initialize the display for the default mode
      this.#setupInitialMode();

      // Update the preview
      this.#updatePreview();

      // Store mount data for future reference
      this.mounts = context.mounts || [];

      // Update pace label with appropriate speed
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

  // ----------------------
  // UI Event Handling Methods
  // ----------------------

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
    if (!this.element || !this.element.contains(event.target)) return;

    const input = event.target;

    // Handle mode switching
    if (input.name === 'travelpace_mode' && input.type === 'radio') {
      this.#switchMode(input.value);
    }

    // Update pace speed display when pace or mount changes
    if (input.id === 'travelpace_pace' || input.id === 'travelpace_mount') {
      setTimeout(() => TravelPaceApp.#updatePaceLabel(this), 0);
    }

    // Update preview for any input change
    this.#updatePreview();
  }

  /**
   * Set up initial mode display based on default selection
   * @private
   */
  #setupInitialMode() {
    const modeInput = this.element.querySelector('input[name="travelpace_mode"]:checked');
    if (modeInput) {
      this.#switchMode(modeInput.value);
    }
  }

  /**
   * Switch between calculator modes
   * @param {string} mode - The mode to switch to ('distance' or 'time')
   * @private
   */
  #switchMode(mode) {
    const distanceSection = this.element.querySelector('.distance-to-time');
    const timeSection = this.element.querySelector('.time-to-distance');

    if (distanceSection && timeSection) {
      distanceSection.style.display = mode === 'distance' ? 'block' : 'none';
      timeSection.style.display = mode === 'time' ? 'block' : 'none';
    }
  }

  /**
   * Update UI with preview calculations
   * @private
   */
  #updatePreview() {
    try {
      const container = this.element;
      if (!container) return;

      const modeInput = container.querySelector('input[name="travelpace_mode"]:checked');
      if (!modeInput) return;

      const mode = modeInput.value;
      const paceSelect = container.querySelector('#travelpace_pace');
      if (!paceSelect) return;

      const pace = paceSelect.value;
      const mountId = container.querySelector('#travelpace_mount')?.value;

      // Get preview element
      const previewEl = container.querySelector('.calculation-preview');
      if (!previewEl) return;

      let preview = '';

      if (mode === 'distance') {
        preview = this.#getDistancePreview(container, pace, mountId);
      } else {
        preview = this.#getTimePreview(container, pace, mountId);
      }

      previewEl.textContent = preview || game.i18n.localize('TravelPace.Preview.Empty');
    } catch (err) {
      console.error('TravelPace | Error updating preview:', err);
      const previewEl = this.element?.querySelector('.calculation-preview');
      if (previewEl) {
        previewEl.textContent = game.i18n.localize('TravelPace.Preview.Error');
      }
    }
  }

  // ----------------------
  // Preview Calculation Methods
  // ----------------------

  /**
   * Get preview text for distance to time calculation
   * @param {HTMLElement} container - The calculator container
   * @param {string} pace - The selected pace
   * @param {string} mountId - The selected mount ID
   * @returns {string} - The preview text
   * @private
   */
  #getDistancePreview(container, pace, mountId) {
    const distanceInput = container.querySelector('#travelpace_distance');
    if (!distanceInput) return '';

    const distance = Number(distanceInput.value || 0);
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
    const daysInput = container.querySelector('#travelpace_days');
    const hoursInput = container.querySelector('#travelpace_hours');
    if (!daysInput || !hoursInput) return '';

    const days = Number(daysInput.value || 0);
    const hours = Number(hoursInput.value || 0);

    if (days <= 0 && hours <= 0) return '';

    const data = {
      mode: 'time',
      time: { days, hours, minutes: 0 },
      pace,
      mountId
    };

    const result = TravelCalculator.calculateTravel(data);

    return `${result.output.distance.toFixed(1)} ${result.output.unit}`;
  }

  // ----------------------
  // Static Mount Handling Methods
  // ----------------------

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

        // Handle both world and compendium actors
        if (id.includes('.')) {
          actor = await fromUuid(id);
        } else {
          actor = game.actors.get(id);
        }

        if (actor) {
          const speed = await TravelPaceApp.#getMountSpeed(actor, useMetric);
          mounts.push({
            id: id,
            name: actor.name,
            speed: speed || 'Unknown'
          });
          console.log(`TravelPace | Added mount: ${actor.name} with speed: ${speed}`);
        } else {
          console.warn(`TravelPace | Could not load mount with ID: ${id}`);
        }
      } catch (error) {
        console.error(`TravelPace | Error loading mount ${id}:`, error);
      }
    }

    console.log(`TravelPace | Total mounts loaded: ${mounts.length}`);
    return mounts;
  }

  /**
   * Submit the calculation to chat
   * @param {Event} event - The click event
   * @private
   */
  static #submitCalculation(event) {
    try {
      // In ApplicationV2 actions, 'this' refers to the application instance
      const app = this;
      const container = app.element;

      if (!container) return;

      const modeInput = container.querySelector('input[name="travelpace_mode"]:checked');
      if (!modeInput) return;

      const mode = modeInput.value;
      const pace = container.querySelector('#travelpace_pace')?.value;
      if (!pace) return;

      const mountId = container.querySelector('#travelpace_mount')?.value;
      const data = { mode, pace, mountId };

      // Collect form data based on the mode
      if (mode === 'distance') {
        const distance = Number(container.querySelector('#travelpace_distance')?.value || 0);
        if (distance <= 0) {
          ui.notifications.warn(game.i18n.localize('TravelPace.Warnings.InvalidDistance'));
          return;
        }
        data.distance = distance;
      } else {
        const days = Number(container.querySelector('#travelpace_days')?.value || 0);
        const hours = Number(container.querySelector('#travelpace_hours')?.value || 0);

        if (days <= 0 && hours <= 0) {
          ui.notifications.warn(game.i18n.localize('TravelPace.Warnings.InvalidTime'));
          return;
        }

        data.time = { days, hours, minutes: 0 };
      }

      // Calculate travel and create chat message
      const result = TravelCalculator.calculateTravel(data);
      TravelCalculator.createChatMessage(result);
    } catch (error) {
      console.error('TravelPace | Error submitting calculation:', error);
      ui.notifications.error(game.i18n.localize('TravelPace.Errors.CalculationFailed'));
    }
  }

  /**
   * Update the pace label with speed information
   * @param {TravelPaceApp} app - The application instance
   * @private
   */
  static #updatePaceLabel(app) {
    try {
      const container = app.element;
      if (!container) return;

      const paceSelect = container.querySelector('#travelpace_pace');
      const paceLabel = container.querySelector('label[for="travelpace_pace"]');
      const mountSelect = container.querySelector('#travelpace_mount');
      if (!paceSelect || !paceLabel) return;

      const pace = paceSelect.value;
      const useMetric = game.settings.get(CONST.moduleId, CONST.settings.useMetric);

      // Default speeds for on foot
      const footSpeeds = {
        fast: useMetric ? '133 m/min' : '400 ft/min',
        normal: useMetric ? '100 m/min' : '300 ft/min',
        slow: useMetric ? '67 m/min' : '200 ft/min'
      };

      let speedText = footSpeeds[pace];

      // If mount is selected, update the speed text
      if (mountSelect?.value) {
        TravelPaceApp.#updateMountSpeedLabel(paceLabel, mountSelect.value, pace);
        return;
      }

      // Update the label with the speed for on foot
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
        const defaultSpeed = useMetric ? '100 m/min' : '300 ft/min';
        paceLabel.innerHTML = `${game.i18n.localize('TravelPace.Labels.Pace')} (${defaultSpeed})`;
        return;
      }

      // Apply the pace multiplier to the mount's speed
      const multiplier = CONST.multipliers[pace];
      let adjustedSpeedText = '';

      // If it's a vehicle with mi/hr or km/hr format
      if (mountSpeed.includes('/hour')) {
        adjustedSpeedText = TravelPaceApp.#formatVehicleSpeed(mountSpeed, multiplier, useMetric);
      } else {
        // For standard walking speeds (ft or m)
        adjustedSpeedText = TravelPaceApp.#formatWalkingSpeed(mountSpeed, multiplier, useMetric);
      }

      // Update the label with the speed
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
    const speedRegex = /^(\d+(\.\d+)?)\s*(mi|km)\/hour$/;
    const match = mountSpeed.match(speedRegex);

    if (!match) return mountSpeed;

    let baseSpeed = parseFloat(match[1]);
    let unit = match[3];

    // Convert units if needed
    if (useMetric && unit === 'mi') {
      unit = 'km';
      baseSpeed = baseSpeed * CONST.conversion.miToKm;
    } else if (!useMetric && unit === 'km') {
      unit = 'mi';
      baseSpeed = baseSpeed * CONST.conversion.kmToMi;
    }

    const adjustedSpeed = (baseSpeed * multiplier).toFixed(1);
    return `${adjustedSpeed} ${unit}/hour`;
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
    const speedRegex = /^(\d+(\.\d+)?)\s*(ft|m)$/;
    const match = mountSpeed.match(speedRegex);

    if (!match) return mountSpeed;

    let baseSpeed = parseFloat(match[1]);
    let unit = match[3];

    // Convert units if needed
    if (useMetric && unit === 'ft') {
      unit = 'm';
      baseSpeed = Math.round(baseSpeed * CONST.conversion.mPerFt);
    } else if (!useMetric && unit === 'm') {
      unit = 'ft';
      baseSpeed = Math.round(baseSpeed / CONST.conversion.mPerFt);
    }

    const adjustedSpeed = Math.round(baseSpeed * multiplier);
    return `${adjustedSpeed} ${unit}/min`;
  }

  /**
   * Get the speed for a mount by ID or directly from an actor
   * @param {string|Actor} mountIdOrActor - Either the ID of the mount or the actor object directly
   * @param {boolean} [useMetric] - Whether to use metric units
   * @returns {Promise<string|null>} - The mount's speed or null if not found
   * @private
   */
  static async #getMountSpeed(mountIdOrActor, useMetric) {
    if (!mountIdOrActor) return null;

    try {
      // If the input is a string (ID), resolve to an actor
      let actor = mountIdOrActor;
      if (typeof mountIdOrActor === 'string') {
        if (mountIdOrActor.includes('.')) {
          actor = await fromUuid(mountIdOrActor);
        } else {
          actor = game.actors.get(mountIdOrActor);
        }
        if (!actor) return null;
      }

      // Get the metric setting if not provided
      if (useMetric === undefined) {
        useMetric = game.settings.get(CONST.moduleId, CONST.settings.useMetric);
      }

      // Extract speed from the actor
      if (actor.type === 'vehicle') {
        return TravelPaceApp.#getVehicleSpeed(actor, useMetric);
      }

      // For NPCs and other actor types (walking speed)
      return TravelPaceApp.#getWalkingSpeed(actor, useMetric);
    } catch (error) {
      console.error(`TravelPace | Error getting mount speed for ${mountIdOrActor}:`, error);
      return 'Unknown';
    }
  }

  /**
   * Get vehicle speed
   * @param {Actor} actor - The vehicle actor
   * @param {boolean} useMetric - Whether to use metric units
   * @returns {string} - The vehicle's speed
   * @private
   */
  static #getVehicleSpeed(actor, useMetric) {
    const movement = actor.system.attributes?.movement || {};

    if (movement.units === 'mi' || movement.units === 'km') {
      // For simplicity, take the highest speed
      const speeds = Object.entries(movement)
        .filter(([key, value]) => typeof value === 'number' && key !== 'units')
        .map(([key, value]) => value);

      if (!speeds.length) return 'Unknown';

      const maxSpeed = Math.max(...speeds);

      // Convert units if needed
      if (useMetric && movement.units === 'mi') {
        return `${(maxSpeed * CONST.conversion.miToKm).toFixed(1)} km/hour`;
      } else if (!useMetric && movement.units === 'km') {
        return `${(maxSpeed * CONST.conversion.kmToMi).toFixed(1)} mi/hour`;
      } else {
        return `${maxSpeed} ${movement.units}/hour`;
      }
    }

    return TravelPaceApp.#getWalkingSpeed(actor, useMetric);
  }

  /**
   * Get walking speed
   * @param {Actor} actor - The actor
   * @param {boolean} useMetric - Whether to use metric units
   * @returns {string} - The walking speed
   * @private
   */
  static #getWalkingSpeed(actor, useMetric) {
    const speed = actor.system.attributes?.movement?.walk || 0;

    if (useMetric) {
      return `${Math.round(speed * CONST.conversion.mPerFt)} m`;
    }

    return `${speed} ft`;
  }
}
