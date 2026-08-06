import { TravelPaceApp } from './app.mjs';
import { CONST } from './config.mjs';
import { calculateDistance, calculateTime, formatTime, getMountSpeedModifier, getPaceEffects } from './helpers.mjs';

/** Coordinator for the Travel Pace calculator: scene-controls integration, calculation entry, chat output. */
export class TravelCalculator {
  static requestor = undefined;

  /**
   * Add the travel-pace button to the token scene controls.
   * @param {object} controls The v13+ scene-controls record object
   */
  static getSceneControlButtons(controls) {
    if (!controls.tokens?.tools) return;
    controls.tokens.tools['travel-pace'] = {
      name: 'travel-pace',
      title: _loc('TravelPace.Button'),
      icon: 'fas fa-route',
      visible: true,
      button: false,
      onChange: (_event, active) => {
        if (active) TravelCalculator.openCalculator();
      }
    };
  }

  /** Open (or re-focus) the calculator window. */
  static openCalculator() {
    if (TravelCalculator.requestor && !TravelCalculator.requestor.rendered) TravelCalculator.requestor = undefined;
    if (!TravelCalculator.requestor) {
      TravelCalculator.requestor = new TravelPaceApp();
      TravelCalculator.requestor.render(true);
    } else {
      TravelCalculator.requestor.bringToFront();
    }
  }

  /**
   * Calculate travel data and emit a chat message.
   * @param {object} data Calculator input payload
   * @returns {Promise<object>} The calculation result
   */
  static async submitCalculation(data) {
    const result = TravelCalculator.calculateTravel(data);
    ATLAS.log(3, `Calculated ${result.mode}`, result);
    const message = await TravelCalculator.createChatMessage(result);
    Hooks.callAll('travelPace.calculated', result, message);
    return result;
  }

  /**
   * Calculate either travel time or travel distance from the calculator payload.
   * @param {object} data Calculator input payload (mode, pace, distance|time, mountId)
   * @returns {object} The structured calculation result
   */
  static calculateTravel(data) {
    const { mode, pace } = data;
    const speedModifier = getMountSpeedModifier(data.mountId);
    const paceEffect = getPaceEffects(pace);
    const useMetric = game.settings.get(CONST.moduleId, CONST.settings.useMetric);
    const unit = useMetric ? _loc('DND5E.DistKmAbbr') : _loc('DND5E.DistMiAbbr');
    if (mode === 'distance') {
      const { distance } = data;
      const distanceInFeet = useMetric ? distance * CONST.conversion.ftPerKm : distance * CONST.conversion.ftPerMile;
      const time = calculateTime(distanceInFeet, pace, speedModifier);
      const totalMinutes = time.days * CONST.timeUnits.minutesPerDay + time.hours * CONST.timeUnits.minutesPerHour + time.minutes;
      return { mode, input: { distance, unit, pace }, output: { timeFormatted: formatTime(time), time, totalMinutes }, paceEffect, speedModifier, mountId: data.mountId };
    }
    const { time } = data;
    const totalMinutes = time.days * CONST.timeUnits.minutesPerDay + time.hours * CONST.timeUnits.minutesPerHour + (time.minutes || 0);
    const distanceData = calculateDistance(totalMinutes, pace, speedModifier);
    const distance = useMetric ? distanceData.kilometers : distanceData.miles;
    return { mode, input: { time, pace }, output: { distance, unit, totalMinutes }, paceEffect, speedModifier, mountId: data.mountId };
  }

  /**
   * Render the calculation as a chat message.
   * @param {object} result A result produced by calculateTravel
   * @returns {Promise<ChatMessage>} The created chat message
   */
  static async createChatMessage(result) {
    const showEffects = game.settings.get(CONST.moduleId, CONST.settings.showEffects);
    const useMetric = game.settings.get(CONST.moduleId, CONST.settings.useMetric);
    let vehicleInfo = null;
    if (result.mountId) {
      const actor = result.mountId.includes('.') ? await fromUuid(result.mountId) : game.actors.get(result.mountId);
      if (actor) vehicleInfo = { speed: TravelCalculator.#getFormattedVehicleSpeed(actor, result.input.pace, useMetric), embed: `@UUID[${actor.uuid}]` };
      else ATLAS.log(2, 'Mount actor not found:', result.mountId);
    }
    const paceLabel = _loc(`TravelPace.Paces.${result.input.pace.charAt(0).toUpperCase()}${result.input.pace.slice(1)}`);
    const speedPercent = typeof result.speedModifier === 'number' ? Math.round(result.speedModifier * 100) : null;
    const content = await foundry.applications.handlebars.renderTemplate('modules/travel-pace/templates/chat-message.hbs', { result, paceLabel, speedPercent, showEffects, vehicleInfo });
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker(), content, flags: { [CONST.moduleId]: { result } } });
  }

  /**
   * Strip or wire up the GM-only advance-time button on a rendered travel-pace card.
   * @param {ChatMessage} message The rendered chat message
   * @param {HTMLElement} html The rendered message element
   */
  static onRenderChatMessage(message, html) {
    const button = html.querySelector('.travel-pace-advance');
    if (!button) return;
    if (!game.user.isGM) button.remove();
    else button.addEventListener('click', () => TravelCalculator.advanceWorldTime(message));
  }

  /**
   * Advance world time by the duration stamped on a travel-pace chat message.
   * @param {ChatMessage} message The message carrying the result flag
   * @returns {Promise<void>}
   */
  static async advanceWorldTime(message) {
    const result = message.getFlag(CONST.moduleId, 'result');
    const seconds = TravelCalculator.durationToSeconds(result?.output?.totalMinutes);
    if (seconds <= 0) return void ui.notifications.warn('TravelPace.Advance.NoDuration', { localize: true });
    const { secondsPerMinute, minutesPerHour, hoursPerDay } = game.time.calendar.days;
    const secondsPerHour = secondsPerMinute * minutesPerHour;
    const secondsPerDay = secondsPerHour * hoursPerDay;
    if (seconds > secondsPerDay) {
      const days = Math.floor(seconds / secondsPerDay);
      const hours = Math.round((seconds % secondsPerDay) / secondsPerHour);
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: 'TravelPace.Advance.Confirm.Title' },
        content: `<p>${_loc('TravelPace.Advance.Confirm.Content', { days, hours })}</p>`
      });
      if (!confirmed) return;
    }
    await game.time.advance(seconds);
  }

  /**
   * Convert a travel duration to world-time seconds using the configured day-advance mode.
   * @param {number} totalMinutes Travel minutes from a calculation result
   * @returns {number} Seconds to advance world time by
   */
  static durationToSeconds(totalMinutes) {
    if (!(totalMinutes > 0)) return 0;
    const { secondsPerMinute, minutesPerHour, hoursPerDay } = game.time.calendar.days;
    if (game.settings.get(CONST.moduleId, CONST.settings.advanceMode) === 'travel') return Math.round(totalMinutes * secondsPerMinute);
    const travelDays = Math.floor(totalMinutes / CONST.timeUnits.minutesPerDay);
    const remainingMinutes = totalMinutes % CONST.timeUnits.minutesPerDay;
    return Math.round(travelDays * hoursPerDay * minutesPerHour * secondsPerMinute + remainingMinutes * secondsPerMinute);
  }

  /**
   * Build a localized speed string for a mount/vehicle adjusted by pace.
   * @param {foundry.documents.Actor} actor The mount or vehicle actor
   * @param {string} pace The selected travel pace
   * @param {boolean} useMetric Whether the world is configured for metric units
   * @returns {string} The localized speed text
   */
  static #getFormattedVehicleSpeed(actor, pace, useMetric) {
    const paceMultiplier = CONST.multipliers[pace] || 1;
    const miAbbrev = _loc('DND5E.DistMiAbbr');
    const kmAbbrev = _loc('DND5E.DistKmAbbr');
    const movement = actor.system.attributes?.movement || {};
    if (actor.type === 'vehicle' && (movement.units === miAbbrev || movement.units === kmAbbrev)) {
      const speeds = Object.entries(movement)
        .filter(([key, value]) => typeof value === 'number' && key !== 'units')
        .map(([, value]) => value);
      if (speeds.length) {
        const maxSpeed = Math.max(...speeds);
        const sourceIsMi = movement.units === miAbbrev;
        const unit = useMetric ? kmAbbrev : miAbbrev;
        const conversion = useMetric && sourceIsMi ? CONST.conversion.miToKm : !useMetric && !sourceIsMi ? CONST.conversion.kmToMi : 1;
        const adjustedSpeed = (maxSpeed * paceMultiplier * conversion).toFixed(1);
        return _loc('TravelPace.Speed.Format.PerHour', { speed: adjustedSpeed, unit });
      }
    }
    const speed = movement.walk || 0;
    const unit = useMetric ? _loc('DND5E.DistMAbbr') : _loc('DND5E.DistFtAbbr');
    const baseSpeed = useMetric ? Math.round(speed * CONST.conversion.mPerFt) : speed;
    const adjustedSpeed = Math.round(baseSpeed * paceMultiplier);
    const fallback = useMetric ? 'TravelPace.Speed.Default.Normal.Metric' : 'TravelPace.Speed.Default.Normal.Imperial';
    return adjustedSpeed > 0 ? _loc('TravelPace.Speed.Format.PerMinute', { speed: adjustedSpeed, unit }) : _loc(fallback);
  }
}
