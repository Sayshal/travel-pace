import { TravelPaceApp } from './app.js';
import { CONST } from './config.js';
import { calculateDistance, calculateTime, convertDistance, formatTime, getMountSpeedModifier, getPaceEffects } from './helpers.js';

/**
 * Main calculator class for handling travel pace calculations and UI interaction
 * @class
 */
export class TravelCalculator {
  /** Reference to the current calculator app instance */
  static requestor;

  /**
   * Add the travel pace button to the token controls
   * @param {Array} buttons - The array of control buttons
   * @static
   */
  static getSceneControlButtons(buttons) {
    try {
      const tokenButton = buttons.find((b) => b.name === 'token');
      if (tokenButton) {
        tokenButton.tools.push({
          name: 'travel-pace',
          title: game.i18n.localize('TravelPace.Button'),
          icon: 'fas fa-route',
          visible: true,
          onClick: () => TravelCalculator.openCalculator(),
          button: false
        });
      }
    } catch (error) {
      console.error('TravelPace | Error adding scene control button:', error);
    }
  }

  /**
   * Open the travel pace calculator or bring it to front if already open
   * @static
   */
  static openCalculator() {
    try {
      if (!TravelCalculator.requestor?.rendered) {
        TravelCalculator.requestor = new TravelPaceApp();
        TravelCalculator.requestor.render(true);
      } else {
        TravelCalculator.requestor.bringToFront();
      }
    } catch (error) {
      console.error('TravelPace | Error opening calculator:', error);
      ui.notifications.error('TravelPace.Errors.OpeningCalculator', { localize: true });
    }
  }

  /**
   * Calculate travel time or distance based on input data
   * @param {Object} data - Calculator input data
   * @returns {Object} - Calculation results
   * @static
   */
  static calculateTravel(data) {
    try {
      const { mode, distance, time, pace, mountId } = data;
      const useMetric = game.settings.get(CONST.moduleId, CONST.settings.useMetric);
      const speedModifier = getMountSpeedModifier(mountId);
      const isVehicleWithDirectSpeed = typeof speedModifier === 'string' && speedModifier.includes('/hour');

      // Distance → Time calculation
      if (mode === 'distance') {
        const result = TravelCalculator.#calculateDistanceToTime(distance, pace, speedModifier, useMetric, isVehicleWithDirectSpeed);
        result.mountId = mountId; // Add mountId to the result
        return result;
      }
      // Time → Distance calculation
      else if (mode === 'time') {
        const result = TravelCalculator.#calculateTimeToDistance(time, pace, speedModifier, useMetric);
        result.mountId = mountId; // Add mountId to the result
        return result;
      }

      // Return empty result if mode is invalid
      console.warn(`TravelPace | Invalid calculation mode: ${mode}`);
      return {
        mode: 'unknown',
        input: {},
        output: {},
        paceEffect: '',
        mountId
      };
    } catch (error) {
      console.error('TravelPace | Error in calculateTravel:', error);
      return {
        mode: 'error',
        input: {},
        output: {
          timeFormatted: game.i18n.localize('TravelPace.Errors.CalculationFailed'),
          distance: 0,
          unit: ''
        },
        paceEffect: '',
        mountId: null
      };
    }
  }

  /**
   * Calculate time based on distance
   * @param {number} distance - Distance value
   * @param {string} pace - Travel pace
   * @param {number|string} speedModifier - Speed modifier or direct speed
   * @param {boolean} useMetric - Whether to use metric units
   * @param {boolean} isVehicleWithDirectSpeed - Whether this is a vehicle with direct speed
   * @returns {Object} - Calculation result
   * @private
   */
  static #calculateDistanceToTime(distance, pace, speedModifier, useMetric, isVehicleWithDirectSpeed) {
    try {
      // Convert distance to feet for calculation
      const fromUnit = useMetric ? 'km' : 'mi';

      // Determine whether to use DnD conversion or standard conversion
      // Use standard conversion only for vehicles with direct speed notation (e.g., "8 mi/hour")
      const useDndConversion = !isVehicleWithDirectSpeed;

      const distanceInFeet = convertDistance(distance, fromUnit, 'ft', useDndConversion);

      // Calculate time, passing the same conversion flag
      const timeData = calculateTime(distanceInFeet, pace, speedModifier, useDndConversion);

      return {
        mode: 'distance',
        input: {
          distance,
          unit: useMetric ? 'km' : 'mi',
          pace
        },
        output: {
          time: timeData,
          timeFormatted: formatTime(timeData)
        },
        paceEffect: getPaceEffects(pace),
        speedModifier
      };
    } catch (error) {
      console.error('TravelPace | Error calculating distance to time:', error);
      return {
        mode: 'distance',
        input: { distance, pace },
        output: { time: {}, timeFormatted: 'Error' },
        paceEffect: '',
        speedModifier
      };
    }
  }

  /**
   * Calculate distance based on time
   * @param {Object} time - Time data (days, hours, minutes)
   * @param {string} pace - Travel pace
   * @param {number|string} speedModifier - Speed modifier or direct speed
   * @param {boolean} useMetric - Whether to use metric units
   * @returns {Object} - Calculation result
   * @private
   */
  static #calculateTimeToDistance(time, pace, speedModifier, useMetric) {
    try {
      // Extract time components
      const { days = 0, hours = 0, minutes = 0, totalMinutes } = time;

      // Calculate total minutes
      const calculatedMinutes = totalMinutes || days * CONST.timeUnits.hoursPerDay * CONST.timeUnits.minutesPerHour + hours * CONST.timeUnits.minutesPerHour + minutes;

      // Calculate distance
      const distanceData = calculateDistance(calculatedMinutes, pace, speedModifier);

      // Get distance in appropriate unit
      const distanceValue = useMetric ? distanceData.kilometers : distanceData.miles;
      const unit = useMetric ? 'km' : 'mi';

      return {
        mode: 'time',
        input: {
          time: { days, hours, minutes },
          totalMinutes: calculatedMinutes,
          pace
        },
        output: {
          distance: distanceValue,
          unit
        },
        paceEffect: getPaceEffects(pace),
        speedModifier
      };
    } catch (error) {
      console.error('TravelPace | Error calculating time to distance:', error);
      return {
        mode: 'time',
        input: { time, pace },
        output: { distance: 0, unit: useMetric ? 'km' : 'mi' },
        paceEffect: '',
        speedModifier
      };
    }
  }

  /**
   * Create a chat message with calculation results
   * @param {Object} result - Calculation results
   * @returns {Promise<ChatMessage>} - The created chat message
   * @static
   */
  static async createChatMessage(result) {
    try {
      const speaker = ChatMessage.getSpeaker();
      const showEffects = game.settings.get(CONST.moduleId, CONST.settings.showEffects);

      // If there's a mount/vehicle, get its information
      let vehicleInfo = null;
      if (result.mountId) {
        try {
          let actor;
          if (result.mountId.includes('.')) {
            actor = await fromUuid(result.mountId);
          } else {
            actor = game.actors.get(result.mountId);
          }

          if (actor) {
            // Get the speed based on the pace
            const useMetric = game.settings.get(CONST.moduleId, CONST.settings.useMetric);
            const speedText = await TravelCalculator.#getFormattedVehicleSpeed(actor, result.input.pace, useMetric);

            vehicleInfo = {
              name: actor.name,
              speed: speedText,
              embed: `@UUID[${actor.uuid}]`
            };
          }
        } catch (error) {
          console.warn('TravelPace | Could not get vehicle information:', error);
          // If we can't get vehicle info, we'll still show the message without it
        }
      }

      // Render the chat message template
      const content = await renderTemplate('modules/travel-pace/templates/chat-message.hbs', {
        result,
        showEffects,
        vehicleInfo
      });

      // Create the chat message with empty flavor text to avoid duplication
      return ChatMessage.create({
        speaker,
        content,
        flavor: '' // Empty flavor text
      });
    } catch (error) {
      console.error('TravelPace | Error creating chat message:', error);
      ui.notifications.error('TravelPace.Errors.MessageCreationFailed', { localize: true });
      return null;
    }
  }

  /**
   * Get formatted vehicle speed text based on pace
   * @param {Actor} actor - The vehicle/mount actor
   * @param {string} pace - The travel pace
   * @param {boolean} useMetric - Whether to use metric units
   * @returns {Promise<string>} - Formatted speed text
   * @private
   */
  static async #getFormattedVehicleSpeed(actor, pace, useMetric) {
    try {
      const paceMultiplier = CONST.multipliers[pace] || 1;
      let speedText = '';

      if (actor.type === 'vehicle') {
        const movement = actor.system.attributes?.movement || {};
        if (movement.units === 'mi' || movement.units === 'km') {
          // For vehicles with mi/hour or km/hour speeds
          const speeds = Object.entries(movement)
            .filter(([key, value]) => typeof value === 'number' && key !== 'units')
            .map(([key, value]) => value);

          if (speeds.length) {
            const maxSpeed = Math.max(...speeds);
            const unit =
              useMetric && movement.units === 'mi' ? 'km'
              : !useMetric && movement.units === 'km' ? 'mi'
              : movement.units;
            const conversionFactor =
              useMetric && movement.units === 'mi' ? CONST.conversion.miToKm
              : !useMetric && movement.units === 'km' ? CONST.conversion.kmToMi
              : 1;

            const adjustedSpeed = (maxSpeed * paceMultiplier * conversionFactor).toFixed(1);
            speedText = `${adjustedSpeed} ${unit}/hour`;
          }
        } else {
          // For vehicles with standard movement
          const speed = movement.walk || 0;
          const unit = useMetric ? 'm' : 'ft';
          const baseSpeed = useMetric ? Math.round(speed * CONST.conversion.mPerFt) : speed;
          const adjustedSpeed = Math.round(baseSpeed * paceMultiplier);
          speedText = `${adjustedSpeed} ${unit}/min`;
        }
      } else {
        // For mounts/NPCs
        const speed = actor.system.attributes?.movement?.walk || 0;
        const unit = useMetric ? 'm' : 'ft';
        const baseSpeed = useMetric ? Math.round(speed * CONST.conversion.mPerFt) : speed;
        const adjustedSpeed = Math.round(baseSpeed * paceMultiplier);
        speedText = `${adjustedSpeed} ${unit}/min`;
      }

      return speedText || (useMetric ? '100 m/min' : '300 ft/min');
    } catch (error) {
      console.error('TravelPace | Error getting formatted vehicle speed:', error);
      return useMetric ? '100 m/min' : '300 ft/min';
    }
  }
}

// Register hooks with explicit function reference
Hooks.on('getSceneControlButtons', (buttons) => TravelCalculator.getSceneControlButtons(buttons));
