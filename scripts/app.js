import { TravelCalculator } from './travel-calculator.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class TravelPaceApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static PARTS = {
    main: {
      template: 'modules/travel-pace/templates/calculator.hbs'
    }
  };

  static DEFAULT_OPTIONS = {
    id: 'travel-pace-calculator',
    title: 'TravelPace.Title',
    classes: ['travel-calculator-window'],
    position: {
      height: 'auto',
      width: '300',
      top: '74',
      left: '120'
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

  constructor(options = {}) {
    super(options);
    game.users.apps.push(this);
  }

  get title() {
    return game.i18n.localize('TravelPace.Title');
  }

  /**
   * Prepare data for the template context
   * @returns {Object} - The template context
   */
  async _prepareContext() {
    // Get available mounts/vehicles
    const enabledMounts = game.settings.get('travel-pace', 'enabledMounts') || {};
    const useMetric = game.settings.get('travel-pace', 'useMetric');

    // Get mounted actors with their speeds
    const mounts = [];
    for (const id in enabledMounts) {
      if (enabledMounts[id]) {
        try {
          // Handle both world and compendium actors
          let actor;
          if (id.includes('.')) {
            // Compendium actor
            actor = await fromUuid(id);
          } else {
            // World actor
            actor = game.actors.get(id);
          }

          if (actor) {
            mounts.push({
              id: id,
              name: actor.name,
              speed: await this._getMountSpeed(actor, useMetric)
            });
          }
        } catch (error) {
          console.error(`Error loading mount with ID ${id}:`, error);
        }
      }
    }

    // Get default speeds in appropriate units
    const speeds = {
      fast: useMetric ? '133 m/min' : '400 ft/min',
      normal: useMetric ? '100 m/min' : '300 ft/min',
      slow: useMetric ? '67 m/min' : '200 ft/min'
    };

    return {
      useMetric,
      units: {
        distance: useMetric ? 'km' : 'mi',
        speed: useMetric ? 'm' : 'ft'
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

  _onFirstRender(context, options) {
    super._onFirstRender?.(context, options);

    // Set up form input event listeners
    this._setupEventListeners();

    // Initialize the display for the default mode
    this._setupInitialMode();

    // Store mount data for future reference
    this.mounts = context.mounts || [];

    // Update pace label with appropriate speed
    this._updatePaceLabel();
  }

  /**
   * Set up event listeners for the calculator form
   */
  _setupEventListeners() {
    // Use event delegation for all input events
    this.element.addEventListener('input', this._handleInputChange.bind(this));
    this.element.addEventListener('change', this._handleInputChange.bind(this));
  }

  /**
   * Handle input or change events for any form control
   * @param {Event} event - The input or change event
   */
  _handleInputChange(event) {
    const input = event.target;

    // Handle mode switching
    if (input.name === 'mode' && input.type === 'radio') {
      this._switchMode(input.value);
    }

    // Update pace speed display when pace or mount changes
    if (input.id === 'pace' || input.id === 'mount') {
      // Using setTimeout to ensure this happens after the value change completes
      setTimeout(() => this._updatePaceLabel(), 0);
    }

    // Update preview for any input change
    this._updatePreview();
  }

  /**
   * Set up initial mode display based on default selection
   */
  _setupInitialMode() {
    const modeInput = this.element.querySelector('input[name="mode"]:checked');
    if (modeInput) {
      this._switchMode(modeInput.value);
    }

    // Initial preview update
    this._updatePreview();
  }

  /**
   * Switch between calculator modes
   * @param {string} mode - The mode to switch to ('distance' or 'time')
   */
  _switchMode(mode) {
    const distanceSection = this.element.querySelector('.distance-to-time');
    const timeSection = this.element.querySelector('.time-to-distance');

    if (distanceSection && timeSection) {
      distanceSection.style.display = mode === 'distance' ? 'block' : 'none';
      timeSection.style.display = mode === 'time' ? 'block' : 'none';
    }
  }

  /**
   * Update UI with preview calculations
   */
  _updatePreview() {
    const container = this.element;
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
        // Distance to time calculation (unchanged)
        const distanceInput = container.querySelector('#distance');
        if (!distanceInput) return;

        const distance = Number(distanceInput.value || 0);
        if (distance > 0) {
          const data = { mode, distance, pace, mountId };
          const result = TravelCalculator.calculateTravel(data);
          preview = result.output.timeFormatted;
        }
      } else {
        // Time to distance calculation (updated to use days and hours)
        const daysInput = container.querySelector('#days');
        const hoursInput = container.querySelector('#hours');
        if (!daysInput || !hoursInput) return;

        const days = Number(daysInput.value || 0);
        const hours = Number(hoursInput.value || 0);

        if (days > 0 || hours > 0) {
          // Convert to minutes: 1 day = 8 hours = 480 minutes
          const totalMinutes = days * 8 * 60 + hours * 60;

          const data = { mode, time: { days, hours, minutes: 0 }, totalMinutes, pace, mountId };
          const result = TravelCalculator.calculateTravel(data);
          preview = `${result.output.distance.toFixed(1)} ${result.output.unit}`;
        }
      }

      previewEl.textContent = preview || game.i18n.localize('TravelPace.Preview.Empty');
    } catch (err) {
      console.error('Error updating travel pace preview:', err);
      previewEl.textContent = game.i18n.localize('TravelPace.Preview.Error');
    }
  }

  /**
   * Clean up when the application is closed
   * @param {Object} options - Closing options
   */
  _onClose(options) {
    super._onClose?.(options);

    // Clean up the static requestor reference
    if (TravelCalculator.requestor === this) {
      TravelCalculator.requestor = undefined;
    }

    // Remove from global apps registry
    const index = game.users.apps.indexOf(this);
    if (index > -1) game.users.apps.splice(index, 1);
  }

  /**
   * Submit the calculation to chat
   * @param {Event} event - The click event
   */
  static _submitCalculation(event) {
    // In ApplicationV2 actions, 'this' refers to the application instance
    const app = this;
    const container = app.element;

    if (!container) {
      console.error('Could not find calculator container');
      return;
    }

    const modeInput = container.querySelector('input[name="mode"]:checked');
    if (!modeInput) {
      console.error('No mode selected');
      return;
    }

    const mode = modeInput.value;
    const paceSelect = container.querySelector('#pace');
    if (!paceSelect) {
      console.error('Pace selector not found');
      return;
    }

    const pace = paceSelect.value;
    const mountId = container.querySelector('#mount')?.value;

    const data = { mode, pace, mountId };

    if (mode === 'distance') {
      const distanceInput = container.querySelector('#distance');
      if (!distanceInput) {
        console.error('Distance input not found');
        return;
      }

      data.distance = Number(distanceInput.value || 0);

      // Validate input
      if (data.distance <= 0) {
        ui.notifications.warn(game.i18n.localize('TravelPace.Warnings.InvalidDistance'), { console: false });
        console.warn('Invalid distance input:', { data });
        return;
      }
    } else {
      const hoursInput = container.querySelector('#hours');
      const minutesInput = container.querySelector('#minutes');
      if (!hoursInput || !minutesInput) {
        console.error('Time inputs not found');
        return;
      }

      data.time = {
        hours: Number(hoursInput.value || 0),
        minutes: Number(minutesInput.value || 0)
      };

      // Validate input
      if (data.time.hours <= 0 && data.time.minutes <= 0) {
        ui.notifications.warn(game.i18n.localize('TravelPace.Warnings.InvalidTime'), { console: false });
        console.warn('Invalid time input:', { data });
        return;
      }
    }

    console.log('Calculation data:', data);

    // Calculate travel
    const result = TravelCalculator.calculateTravel(data);
    console.log('Calculation result:', result);

    // Create chat message
    TravelCalculator.createChatMessage(result);
  }

  _updatePaceLabel() {
    const container = this.element;
    if (!container) return;

    const paceSelect = container.querySelector('#pace');
    const paceLabel = container.querySelector('label[for="pace"]');
    const mountSelect = container.querySelector('#mount');
    if (!paceSelect || !paceLabel) return;

    const pace = paceSelect.value;
    const useMetric = game.settings.get('travel-pace', 'useMetric');

    // Pace modifiers - these should match the values in helpers.js
    const paceMultipliers = {
      fast: 1.33,
      normal: 1.0,
      slow: 0.67
    };

    // Default speeds for on foot
    const footSpeeds = {
      fast: useMetric ? '133 m/min' : '400 ft/min',
      normal: useMetric ? '100 m/min' : '300 ft/min',
      slow: useMetric ? '67 m/min' : '200 ft/min'
    };

    let speedText = footSpeeds[pace];

    // If mount is selected, update the speed text
    if (mountSelect && mountSelect.value) {
      const mountId = mountSelect.value;

      // Instead of using this.context, fetch the mount data directly
      this._getMountSpeed(mountId).then((mountSpeed) => {
        if (mountSpeed) {
          // Apply the pace multiplier to the mount's speed
          const multiplier = paceMultipliers[pace];

          // If it's a vehicle with mi/hr or km/hr format
          if (mountSpeed.includes('/hour')) {
            // Parse the speed value
            const speedRegex = /^(\d+(\.\d+)?)\s*(mi|km)\/hour$/;
            const match = mountSpeed.match(speedRegex);

            if (match) {
              let baseSpeed = parseFloat(match[1]);
              let unit = match[3];

              // Convert to metric if needed
              if (useMetric && unit === 'mi') {
                unit = 'km';
                // Convert miles to kilometers (1 mile ≈ 1.6 km)
                baseSpeed = baseSpeed * 1.6;
              } else if (!useMetric && unit === 'km') {
                unit = 'mi';
                // Convert kilometers to miles (1 km ≈ 0.62 mi)
                baseSpeed = baseSpeed * 0.62;
              }

              const adjustedSpeed = (baseSpeed * multiplier).toFixed(1);
              speedText = `${adjustedSpeed} ${unit}/hour`;
            } else {
              speedText = mountSpeed;
            }
          }
          // For standard walking speeds (ft or m)
          else {
            const speedRegex = /^(\d+(\.\d+)?)\s*(ft|m)$/;
            const match = mountSpeed.match(speedRegex);

            if (match) {
              let baseSpeed = parseFloat(match[1]);
              let unit = match[3];
              let convertedSpeed = baseSpeed;

              // Convert units if needed
              if (useMetric && unit === 'ft') {
                unit = 'm';
                convertedSpeed = Math.round(baseSpeed * 0.3); // Convert ft to m
              } else if (!useMetric && unit === 'm') {
                unit = 'ft';
                convertedSpeed = Math.round(baseSpeed * 3.33); // Convert m to ft
              }

              const adjustedSpeed = Math.round(convertedSpeed * multiplier);

              // Convert to per minute for display consistency
              speedText = `${adjustedSpeed} ${unit}/min`;
            } else {
              speedText = mountSpeed;
            }
          }

          // Update the label with the speed
          paceLabel.innerHTML = `${game.i18n.localize('TravelPace.Labels.Pace')} (${speedText})`;
        } else {
          // Just use the default speed if no mount speed found
          paceLabel.innerHTML = `${game.i18n.localize('TravelPace.Labels.Pace')} (${speedText})`;
        }
      });
      return; // Exit early since we're handling the update in the promise
    }

    // Update the label with the speed if no mount selected
    paceLabel.innerHTML = `${game.i18n.localize('TravelPace.Labels.Pace')} (${speedText})`;
  }

  /**
   * Get the speed for a mount by ID or directly from an actor
   * @param {string|Actor} mountIdOrActor - Either the ID of the mount or the actor object directly
   * @param {boolean} [useMetric] - Whether to use metric units (only needed when passing an actor)
   * @returns {Promise<string|null>} - The mount's speed or null if not found
   * @private
   */
  async _getMountSpeed(mountIdOrActor, useMetric) {
    // If no input, return null
    if (!mountIdOrActor) return null;

    // If the input is a string (ID), resolve to an actor
    let actor = mountIdOrActor;
    if (typeof mountIdOrActor === 'string') {
      try {
        // Handle both world and compendium actors
        if (mountIdOrActor.includes('.')) {
          // Compendium actor
          actor = await fromUuid(mountIdOrActor);
        } else {
          // World actor
          actor = game.actors.get(mountIdOrActor);
        }

        if (!actor) return null;
      } catch (error) {
        console.error(`Error getting mount for ID ${mountIdOrActor}:`, error);
        return null;
      }
    }

    // Get the metric setting if not provided
    if (useMetric === undefined) {
      useMetric = game.settings.get('travel-pace', 'useMetric');
    }

    // Extract speed from the actor
    if (actor.type === 'vehicle') {
      // Handle vehicle speeds which might be in miles or kilometers per hour
      const movement = actor.system.attributes?.movement || {};
      if (movement.units === 'mi' || movement.units === 'km') {
        // For simplicity, we'll just take the highest speed
        const speeds = Object.entries(movement)
          .filter(([key, value]) => typeof value === 'number' && key !== 'units')
          .map(([key, value]) => value);

        if (speeds.length) {
          const maxSpeed = Math.max(...speeds);
          // Use the actor's native unit if it matches the metric setting
          // or convert if needed
          if (useMetric && movement.units === 'mi') {
            // Convert miles to kilometers
            return `${(maxSpeed * 1.6).toFixed(1)} km/hour`;
          } else if (!useMetric && movement.units === 'km') {
            // Convert kilometers to miles
            return `${(maxSpeed * 0.62).toFixed(1)} mi/hour`;
          } else {
            // No conversion needed
            return `${maxSpeed} ${movement.units}/hour`;
          }
        }
        return 'Unknown';
      }
    }

    // For NPCs and other actor types
    const speed = actor.system.attributes?.movement?.walk || 0;
    // Convert if necessary
    if (useMetric) {
      return `${Math.round(speed * 0.3)} m`;
    }
    return `${speed} ft`;
  }
}
