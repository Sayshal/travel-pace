import { TravelPaceApp } from './app.js';
import { calculateDistance, calculateTime, convertDistance, formatTime, getMountSpeedModifier, getPaceEffects } from './helpers.js';

// Main calculator class
export class TravelCalculator {
  static getSceneControlButtons(buttons) {
    let tokenButton = buttons.find((b) => b.name === 'token');
    if (tokenButton) {
      tokenButton.tools.push({
        name: 'travel-pace',
        title: game.i18n.localize('TravelPace.Button'),
        icon: 'fas fa-route',
        visible: true,
        onClick: () => TravelCalculator.requestMeasure()
      });
    }
  }

  static requestMeasure() {
    if (TravelCalculator.requestor === undefined || !TravelCalculator.requestor.rendered) {
      TravelCalculator.requestor = new TravelPaceApp();
      TravelCalculator.requestor.render(true);
    } else if (TravelCalculator.requestor.rendered) {
      TravelCalculator.requestor.bringToFront();
    }
  }

  /**
   * Calculate travel time based on distance and pace
   * @param {Object} data - Calculator input data
   * @returns {Object} - Calculation results
   */
  static calculateTravel(data) {
    const { mode, distance, time, pace, mountId } = data;
    const useMetric = game.settings.get('travel-pace', 'useMetric');
    const speedModifier = getMountSpeedModifier(mountId);

    // Determine if this is a vehicle with mi/hour or km/hour speed
    const isVehicleWithDirectSpeed = typeof speedModifier === 'string' && speedModifier.includes('/hour');

    // Log the calculation details
    console.log(`Travel calculation with:
    - Mode: ${mode}
    - Pace: ${pace}
    - Speed: ${speedModifier}
    - Mount ID: ${mountId}
    - Using vehicle conversion: ${isVehicleWithDirectSpeed}`);

    let result = {};

    // Distance → Time calculation
    if (mode === 'distance') {
      // Convert distance to feet for calculation
      const fromUnit = useMetric ? 'km' : 'mi';

      // For vehicles with direct speed notation, use standard conversions
      // For on-foot travel, use D&D simplified conversions
      const distanceInFeet = convertDistance(
        distance,
        fromUnit,
        'ft',
        !isVehicleWithDirectSpeed // Use D&D conversion only for non-vehicle travel
      );

      // Log the converted distance
      console.log(`Converting ${distance} ${fromUnit} to ${distanceInFeet} feet
                (using ${isVehicleWithDirectSpeed ? 'standard' : 'D&D'} conversion)`);

      // Calculate time
      const timeData = calculateTime(distanceInFeet, pace, speedModifier);

      result = {
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
    }
    // Time → Distance calculation
    else if (mode === 'time') {
      // Convert time to minutes
      const { days = 0, hours = 0, minutes = 0, totalMinutes } = time;

      // If totalMinutes is directly provided, use it, otherwise calculate
      const calculatedMinutes =
        totalMinutes ||
        days * 8 * 60 + // 8 hours per travel day
          hours * 60 +
          minutes;

      // Calculate distance
      const distanceData = calculateDistance(calculatedMinutes, pace, speedModifier);

      // Format distance in appropriate units
      const distanceValue = useMetric ? distanceData.kilometers : distanceData.miles;
      const unit = useMetric ? 'km' : 'mi';

      result = {
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
    }

    return result;
  }

  /**
   * Create a chat message with calculation results
   * @param {Object} result - Calculation results
   * @returns {Promise<ChatMessage>} - The created chat message
   */
  static async createChatMessage(result) {
    const speaker = ChatMessage.getSpeaker();

    // Render the chat message template
    const content = await renderTemplate('modules/travel-pace/templates/chat-message.hbs', {
      result,
      showEffects: game.settings.get('travel-pace', 'showEffects')
    });

    // Create the chat message
    return ChatMessage.create({
      speaker,
      content,
      flavor: game.i18n.localize('TravelPace.ChatMessage.Title')
    });
  }
}

// Register hooks
Hooks.on('getSceneControlButtons', TravelCalculator.getSceneControlButtons);
