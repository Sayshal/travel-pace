import { TravelPaceApp } from './app.js';
import { CONST } from './config.js';
import { calculateDistance, calculateTime, formatTime, getMountSpeedModifier, getPaceEffects } from './helpers.js';

/**
 * Main travel calculator module
 * @class
 */
export class TravelCalculator {
  static requestor = undefined;

  /**
   * Add the travel pace button to the token controls
   * @param {Object} controls - The scene controls object in V13
   * @static
   */
  static getSceneControlButtons(controls) {
    try {
      if (controls.tokens && controls.tokens.tools) {
        controls.tokens.tools['travel-pace'] = {
          name: 'travel-pace',
          title: game.i18n.localize('TravelPace.Button'),
          icon: 'fas fa-route',
          visible: true,
          onChange: (event, active) => {
            if (active) TravelCalculator.openCalculator();
          },
          button: false
        };
      }
    } catch (error) {
      console.error('TravelPace | Error adding scene control button:', error);
    }
  }

  /**
   * Open the travel pace calculator
   * @static
   */
  static openCalculator() {
    try {
      if (TravelCalculator.requestor && !TravelCalculator.requestor.rendered) TravelCalculator.requestor = undefined;
      if (!TravelCalculator.requestor) {
        TravelCalculator.requestor = new TravelPaceApp();
        TravelCalculator.requestor.render(true);
      } else {
        TravelCalculator.requestor.bringToTop();
      }
    } catch (error) {
      console.error('TravelPace | Error opening calculator:', error);
      ui.notifications.error(game.i18n.localize('TravelPace.Errors.OpeningCalculator'));
    }
  }

  /**
   * Submit a travel calculation and create a chat message
   * @param {Object} data - Calculation data
   * @returns {Promise<Object|null>} - Calculation result or null if failed
   * @static
   */
  static async submitCalculation(data) {
    try {
      const result = TravelCalculator.calculateTravel(data);
      if (result) {
        await TravelCalculator.createChatMessage(result);
        return result;
      }
      return null;
    } catch (error) {
      console.error('TravelPace | Error submitting calculation:', error);
      ui.notifications.error(game.i18n.localize('TravelPace.Errors.CalculationFailed'));
      return null;
    }
  }

  /**
   * Calculate travel time or distance
   * @param {Object} data - Input data
   * @returns {Object} - Calculation results
   * @static
   */
  static calculateTravel(data) {
    try {
      const { mode, pace } = data;
      const speedModifier = getMountSpeedModifier(data.mountId);
      const paceEffect = getPaceEffects(pace);
      const useMetric = game.settings.get(CONST.moduleId, CONST.settings.useMetric);
      if (mode === 'distance') {
        const { distance } = data;
        const distanceInFeet = useMetric ? distance * CONST.conversion.ftPerKm : distance * CONST.conversion.ftPerMile;
        const timeData = calculateTime(distanceInFeet, pace, speedModifier);
        const timeFormatted = formatTime(timeData);
        return {
          mode,
          input: {
            distance,
            unit: useMetric ? game.i18n.localize('DND5E.DistKmAbbr') : game.i18n.localize('DND5E.DistMiAbbr'),
            pace
          },
          output: { timeFormatted },
          paceEffect,
          speedModifier,
          mountId: data.mountId
        };
      } else {
        const { time } = data;
        const totalMinutes = time.days * CONST.timeUnits.minutesPerDay + time.hours * CONST.timeUnits.minutesPerHour + (time.minutes || 0);
        const distanceData = calculateDistance(totalMinutes, pace, speedModifier);
        const distance = useMetric ? distanceData.kilometers : distanceData.miles;
        return {
          mode,
          input: { time, pace },
          output: {
            distance,
            unit: useMetric ? game.i18n.localize('DND5E.DistKmAbbr') : game.i18n.localize('DND5E.DistMiAbbr')
          },
          paceEffect,
          speedModifier,
          mountId: data.mountId
        };
      }
    } catch (error) {
      console.error('TravelPace | Error in calculateTravel:', error);
      const useMetric = game.settings.get(CONST.moduleId, CONST.settings.useMetric);
      return {
        mode: 'distance',
        input: {
          distance: 0,
          unit: useMetric ? game.i18n.localize('DND5E.DistKmAbbr') : game.i18n.localize('DND5E.DistMiAbbr'),
          pace: 'normal'
        },
        output: { timeFormatted: game.i18n.localize('TravelPace.Time.NoTime') },
        paceEffect: '',
        speedModifier: 1
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
      let vehicleInfo = null;
      if (result.mountId) {
        try {
          let actor;
          if (result.mountId.includes('.')) actor = await fromUuid(result.mountId);
          else actor = game.actors.get(result.mountId);
          if (actor) {
            const useMetric = game.settings.get(CONST.moduleId, CONST.settings.useMetric);
            const speedText = await TravelCalculator.#getFormattedVehicleSpeed(actor, result.input.pace, useMetric);
            vehicleInfo = { name: actor.name, speed: speedText, embed: `@UUID[${actor.uuid}]` };
          }
        } catch (error) {
          console.warn('TravelPace | Could not get vehicle information:', error);
        }
      }
      const content = await foundry.applications.handlebars.renderTemplate('modules/travel-pace/templates/chat-message.hbs', {
        result,
        showEffects,
        vehicleInfo
      });
      return ChatMessage.create({ speaker, content, flavor: '' });
    } catch (error) {
      console.error('TravelPace | Error creating chat message:', error);
      ui.notifications.error(game.i18n.localize('TravelPace.Errors.MessageCreationFailed'));
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
        const miAbbrev = game.i18n.localize('DND5E.DistMiAbbr');
        const kmAbbrev = game.i18n.localize('DND5E.DistKmAbbr');
        if (movement.units === miAbbrev || movement.units === kmAbbrev) {
          const speeds = Object.entries(movement)
            .filter(([key, value]) => typeof value === 'number' && key !== 'units')
            .map(([key, value]) => value);
          if (speeds.length) {
            const maxSpeed = Math.max(...speeds);
            const unit = useMetric && movement.units === miAbbrev ? kmAbbrev : !useMetric && movement.units === kmAbbrev ? miAbbrev : movement.units === miAbbrev ? miAbbrev : kmAbbrev;
            const conversionFactor = useMetric && movement.units === miAbbrev ? CONST.conversion.miToKm : !useMetric && movement.units === kmAbbrev ? CONST.conversion.kmToMi : 1;
            const adjustedSpeed = (maxSpeed * paceMultiplier * conversionFactor).toFixed(1);
            speedText = game.i18n.format('TravelPace.Speed.Format.PerHour', { speed: adjustedSpeed, unit });
          }
        } else {
          const speed = movement.walk || 0;
          const unit = useMetric ? game.i18n.localize('DND5E.DistMAbbr') : game.i18n.localize('DND5E.DistFtAbbr');
          const baseSpeed = useMetric ? Math.round(speed * CONST.conversion.mPerFt) : speed;
          const adjustedSpeed = Math.round(baseSpeed * paceMultiplier);
          speedText = game.i18n.format('TravelPace.Speed.Format.PerMinute', { speed: adjustedSpeed, unit });
        }
      } else {
        const speed = actor.system.attributes?.movement?.walk || 0;
        const unit = useMetric ? game.i18n.localize('DND5E.DistMAbbr') : game.i18n.localize('DND5E.DistFtAbbr');
        const baseSpeed = useMetric ? Math.round(speed * CONST.conversion.mPerFt) : speed;
        const adjustedSpeed = Math.round(baseSpeed * paceMultiplier);
        speedText = game.i18n.format('TravelPace.Speed.Format.PerMinute', { speed: adjustedSpeed, unit });
      }
      return speedText || (useMetric ? game.i18n.localize('TravelPace.Speed.Default.Normal.Metric') : game.i18n.localize('TravelPace.Speed.Default.Normal.Imperial'));
    } catch (error) {
      console.error('TravelPace | Error getting formatted vehicle speed:', error);
      return useMetric ? game.i18n.localize('TravelPace.Speed.Default.Normal.Metric') : game.i18n.localize('TravelPace.Speed.Default.Normal.Imperial');
    }
  }
}

Hooks.on('getSceneControlButtons', (controls) => TravelCalculator.getSceneControlButtons(controls));
