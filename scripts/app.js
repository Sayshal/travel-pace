import { CONST } from './config.js';
import { TravelCalculator } from './travel-calculator.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Main application for the Travel Pace calculator
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
      submitCalculation: TravelPaceApp._submitCalculation
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
   */
  get title() {
    return game.i18n.localize('TravelPace.Title');
  }

  /**
   * Prepare data for the template context
   * @returns {Promise<Object>} - The template context
   */
  async _prepareContext() {
    // Get settings
    const enabledMounts = game.settings.get(CONST.moduleId, CONST.settings.enabledMounts) || {};
    const useMetric = game.settings.get(CONST.moduleId, CONST.settings.useMetric);

    // Get mounted actors with their speeds
    const mounts = await TravelPaceApp._getAvailableMounts(enabledMounts, useMetric);

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
  }

  /**
   * Get available mounts from enabled mounts config
   * @param {Object} enabledMounts - Enabled mounts configuration
   * @param {boolean} useMetric - Whether to use metric units
   * @returns {Promise<Array>} - Array of available mounts
   */
  static async _getAvailableMounts(enabledMounts, useMetric) {
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
          mounts.push({
            id: id,
            name: actor.name,
            speed: await TravelPaceApp._getMountSpeed(actor, useMetric)
          });
        }
      } catch (error) {
        throw new Error(error);
      }
    }

    return mounts;
  }

  /**
   * Setup after render
   * @param {Object} context - Application context
   * @param {Object} options - Render options
   */
  _onRender(context, options) {
    // Set up form event listeners
    TravelPaceApp._setupEventListeners(this);

    // Initialize the display for the default mode
    TravelPaceApp._setupInitialMode(this);

    // Update the preview
    TravelPaceApp._updatePreview(this);

    // Store mount data for future reference
    this.mounts = context.mounts || [];

    // Update pace label with appropriate speed
    TravelPaceApp._updatePaceLabel(this);
  }

  /**
   * Set up event listeners for the calculator form
   * @param {TravelPaceApp} app - The application instance
   */
  static _setupEventListeners(app) {
    if (!app.element) return;

    // Use static methods with explicit app reference
    app.element.addEventListener('input', (event) => {
      TravelPaceApp._handleInputChange(event, app);
    });

    app.element.addEventListener('change', (event) => {
      TravelPaceApp._handleInputChange(event, app);
    });
  }

  /**
   * Handle input or change events for any form control
   * @param {Event} event - The input or change event
   * @param {TravelPaceApp} app - The application instance
   */
  static _handleInputChange(event, app) {
    if (!app.element || !app.element.contains(event.target)) return;

    const input = event.target;

    // Handle mode switching
    if (input.name === 'mode' && input.type === 'radio') {
      TravelPaceApp._switchMode(input.value, app);
    }

    // Update pace speed display when pace or mount changes
    if (input.id === 'pace' || input.id === 'mount') {
      setTimeout(() => TravelPaceApp._updatePaceLabel(app), 0);
    }

    // Update preview for any input change
    TravelPaceApp._updatePreview(app);
  }

  /**
   * Set up initial mode display based on default selection
   * @param {TravelPaceApp} app - The application instance
   */
  static _setupInitialMode(app) {
    const modeInput = app.element.querySelector('input[name="mode"]:checked');
    if (modeInput) {
      TravelPaceApp._switchMode(modeInput.value, app);
    }
  }

  /**
   * Switch between calculator modes
   * @param {string} mode - The mode to switch to ('distance' or 'time')
   * @param {TravelPaceApp} app - The application instance
   */
  static _switchMode(mode, app) {
    const distanceSection = app.element.querySelector('.distance-to-time');
    const timeSection = app.element.querySelector('.time-to-distance');

    if (distanceSection && timeSection) {
      distanceSection.style.display = mode === 'distance' ? 'block' : 'none';
      timeSection.style.display = mode === 'time' ? 'block' : 'none';
    }
  }

  /**
   * Update UI with preview calculations
   * @param {TravelPaceApp} app - The application instance
   */
  static _updatePreview(app) {
    const container = app.element;
    if (!container) return;

    const modeInput = container.querySelector('input[name="mode"]:checked');
    if (!modeInput) return;

    const mode = modeInput.value;
    const paceSelect = container.querySelector('#pace');
    if (!paceSelect) return;

    const pace = paceSelect.value;
    const mountId = container.querySelector('#mount')?.value;

    // Get preview element
    const previewEl = container.querySelector('.calculation-preview');
    if (!previewEl) return;

    try {
      let preview = '';

      if (mode === 'distance') {
        preview = TravelPaceApp._getDistancePreview(container, pace, mountId);
      } else {
        preview = TravelPaceApp._getTimePreview(container, pace, mountId);
      }

      previewEl.textContent = preview || game.i18n.localize('TravelPace.Preview.Empty');
    } catch (err) {
      previewEl.textContent = game.i18n.localize('TravelPace.Preview.Error');
    }
  }

  /**
   * Get preview text for distance to time calculation
   * @param {HTMLElement} container - The calculator container
   * @param {string} pace - The selected pace
   * @param {string} mountId - The selected mount ID
   * @returns {string} - The preview text
   */
  static _getDistancePreview(container, pace, mountId) {
    const distanceInput = container.querySelector('#distance');
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
   */
  static _getTimePreview(container, pace, mountId) {
    const daysInput = container.querySelector('#days');
    const hoursInput = container.querySelector('#hours');
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

  /**
   * Clean up when the application is closed
   * @param {Object} options - Closing options
   */
  _onClose(options) {
    if (super._onClose) {
      super._onClose(options);
    }

    // Explicitly remove event listeners for this application
    if (this.element) {
      const element = this.element;
      // Remove all event listeners by replacing the element with its clone
      element.replaceWith(element.cloneNode(true));
    }

    // Clean up the static requestor reference
    if (TravelCalculator.requestor === this) {
      TravelCalculator.requestor = undefined;
    }

    // Remove from global apps registry
    const index = game.users.apps.indexOf(this);
    if (index > -1) game.users.apps.splice(index, 1);

    // Only proceed if the canvas is ready and UI is initialized
    if (!canvas?.ready || !ui?.controls) return;

    // Get the current control set
    const controls = ui.controls;

    // Only proceed if we're currently on the token control set
    if (controls.activeControl === 'token') {
      // Initialize the controls with the select tool
      controls.initialize({
        control: 'token',
        tool: 'select'
      });

      // This will handle updating the UI state and refreshing as needed
      controls.render();
    }
  }

  /**
   * Submit the calculation to chat
   * @param {Event} event - The click event
   */
  static _submitCalculation(event) {
    // In ApplicationV2 actions, 'this' refers to the application instance
    const app = this;
    const container = app.element;

    if (!container) return;

    const modeInput = container.querySelector('input[name="mode"]:checked');
    if (!modeInput) return;

    const mode = modeInput.value;
    const pace = container.querySelector('#pace')?.value;
    if (!pace) return;

    const mountId = container.querySelector('#mount')?.value;
    const data = { mode, pace, mountId };

    // Collect form data based on the mode
    if (mode === 'distance') {
      const distance = Number(container.querySelector('#distance')?.value || 0);
      if (distance <= 0) {
        ui.notifications.warn(game.i18n.localize('TravelPace.Warnings.InvalidDistance'));
        return;
      }
      data.distance = distance;
    } else {
      const days = Number(container.querySelector('#days')?.value || 0);
      const hours = Number(container.querySelector('#hours')?.value || 0);

      if (days <= 0 && hours <= 0) {
        ui.notifications.warn(game.i18n.localize('TravelPace.Warnings.InvalidTime'));
        return;
      }

      data.time = { days, hours, minutes: 0 };
    }

    // Calculate travel and create chat message
    const result = TravelCalculator.calculateTravel(data);
    TravelCalculator.createChatMessage(result);
  }

  /**
   * Update the pace label with speed information
   * @param {TravelPaceApp} app - The application instance
   */
  static _updatePaceLabel(app) {
    const container = app.element;
    if (!container) return;

    const paceSelect = container.querySelector('#pace');
    const paceLabel = container.querySelector('label[for="pace"]');
    const mountSelect = container.querySelector('#mount');
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
      TravelPaceApp._updateMountSpeedLabel(paceLabel, mountSelect.value, pace);
      return;
    }

    // Update the label with the speed for on foot
    paceLabel.innerHTML = `${game.i18n.localize('TravelPace.Labels.Pace')} (${speedText})`;
  }

  /**
   * Update the pace label with mount speed
   * @param {HTMLElement} paceLabel - The pace label element
   * @param {string} mountId - The mount ID
   * @param {string} pace - The selected pace
   */
  static async _updateMountSpeedLabel(paceLabel, mountId, pace) {
    const useMetric = game.settings.get(CONST.moduleId, CONST.settings.useMetric);
    const mountSpeed = await TravelPaceApp._getMountSpeed(mountId, useMetric);

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
      adjustedSpeedText = TravelPaceApp._formatVehicleSpeed(mountSpeed, multiplier, useMetric);
    } else {
      // For standard walking speeds (ft or m)
      adjustedSpeedText = TravelPaceApp._formatWalkingSpeed(mountSpeed, multiplier, useMetric);
    }

    // Update the label with the speed
    paceLabel.innerHTML = `${game.i18n.localize('TravelPace.Labels.Pace')} (${adjustedSpeedText})`;
  }

  /**
   * Format vehicle speed with pace multiplier
   * @param {string} mountSpeed - The mount's speed
   * @param {number} multiplier - The pace multiplier
   * @param {boolean} useMetric - Whether to use metric units
   * @returns {string} - Formatted speed text
   */
  static _formatVehicleSpeed(mountSpeed, multiplier, useMetric) {
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
   */
  static _formatWalkingSpeed(mountSpeed, multiplier, useMetric) {
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
   */
  static async _getMountSpeed(mountIdOrActor, useMetric) {
    if (!mountIdOrActor) return null;

    // If the input is a string (ID), resolve to an actor
    let actor = mountIdOrActor;
    if (typeof mountIdOrActor === 'string') {
      try {
        if (mountIdOrActor.includes('.')) {
          actor = await fromUuid(mountIdOrActor);
        } else {
          actor = game.actors.get(mountIdOrActor);
        }

        if (!actor) return null;
      } catch (error) {
        return null;
      }
    }

    // Get the metric setting if not provided
    if (useMetric === undefined) {
      useMetric = game.settings.get(CONST.moduleId, CONST.settings.useMetric);
    }

    // Extract speed from the actor
    if (actor.type === 'vehicle') {
      return TravelPaceApp._getVehicleSpeed(actor, useMetric);
    }

    // For NPCs and other actor types (walking speed)
    return TravelPaceApp._getWalkingSpeed(actor, useMetric);
  }

  /**
   * Get vehicle speed
   * @param {Actor} actor - The vehicle actor
   * @param {boolean} useMetric - Whether to use metric units
   * @returns {string} - The vehicle's speed
   */
  static _getVehicleSpeed(actor, useMetric) {
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

    return TravelPaceApp._getWalkingSpeed(actor, useMetric);
  }

  /**
   * Get walking speed
   * @param {Actor} actor - The actor
   * @param {boolean} useMetric - Whether to use metric units
   * @returns {string} - The walking speed
   */
  static _getWalkingSpeed(actor, useMetric) {
    const speed = actor.system.attributes?.movement?.walk || 0;

    if (useMetric) {
      return `${Math.round(speed * CONST.conversion.mPerFt)} m`;
    }

    return `${speed} ft`;
  }
}
