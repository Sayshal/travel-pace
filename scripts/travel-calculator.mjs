import { MODULE, SETTINGS, TEMPLATES } from './constants.mjs';
import { getWeatherModifiers } from './integrations/calendaria.mjs';
import {
  breakdownMinutesToTimeUnits,
  calculateDistance,
  calculateTime,
  effectivePace,
  formatMountSpeed,
  formatTime,
  getPaceEffects,
  getTravellerSpeed,
  minutesPerHour,
  timeToMinutes,
  travelUnits,
  unitAbbreviation
} from './utils.mjs';

/** Turns calculator input into a result, a chat card, and a world-time advance. */
export class TravelCalculator {
  /**
   * The distance unit abbreviation the world is configured for.
   * @returns {string} The localized unit abbreviation
   */
  static get unit() {
    return unitAbbreviation(travelUnits().length);
  }

  /**
   * Calculate travel data and emit a chat message.
   * @param {object} data Calculator input payload
   * @returns {Promise<object|null>} The calculation result, or null when a listener cancelled it
   */
  static async submitCalculation(data) {
    const result = TravelCalculator.calculateTravel(data);
    if (!result) return null;
    ATLAS.log(3, `Calculated ${result.mode}`, result);
    const message = await TravelCalculator.createChatMessage(result);
    Hooks.callAll('travelPace.calculated', result, message);
    return result;
  }

  /**
   * Calculate either travel time or travel distance from the calculator payload.
   * @param {object} data Calculator input payload (mode, pace, distance|time, mount)
   * @returns {object|null} The structured calculation result, or null when a listener cancelled it
   */
  static calculateTravel(data) {
    const modifiers = getWeatherModifiers();
    if (Hooks.call('travelPace.preCalculate', { data, modifiers }) === false) return null;
    const { mode, mount = null } = data;
    const pace = effectivePace(mount, data.pace);
    const speed = getTravellerSpeed(mount, data.travelType);
    const unit = TravelCalculator.unit;
    const extraMultiplier = modifiers.reduce((product, modifier) => product * (Number(modifier.multiplier) > 0 ? Number(modifier.multiplier) : 1), 1);
    const shared = { paceEffect: speed.paced ? getPaceEffects(pace) : '', paceSlowed: pace !== data.pace, speed, modifiers, extraMultiplier, mountUuid: mount?.uuid ?? null };
    if (mode === 'distance') {
      const time = calculateTime(data.distance, pace, speed, extraMultiplier);
      return { mode, input: { distance: data.distance, unit, pace }, output: { timeFormatted: formatTime(time), time, totalMinutes: time ? timeToMinutes(time, speed.hours) : 0 }, ...shared };
    }
    const totalMinutes = timeToMinutes(data.time, speed.hours);
    return { mode, input: { time: data.time, pace }, output: { distance: calculateDistance(totalMinutes, pace, speed, extraMultiplier), unit, totalMinutes }, ...shared };
  }

  /**
   * Phrase a labeled multiplier as a sentence naming its direction and size.
   * @param {{id: string, label: string, multiplier: number}} modifier A labeled multiplier from the result
   * @returns {string} Localized sentence describing the modifier
   */
  static #describeModifier({ id, label, multiplier }) {
    const key = multiplier < 1 ? 'TRAVELPACE.ChatMessage.ModifierSlower' : 'TRAVELPACE.ChatMessage.ModifierFaster';
    const name = id === 'weather.severity' ? _loc('TRAVELPACE.ChatMessage.SeverityLabel', { label: _loc(label) }) : _loc(label);
    return _loc(key, { label: name, percent: Math.round(Math.abs(1 - multiplier) * 100) });
  }

  /**
   * Render the calculation as a chat message.
   * @param {object} result A result produced by calculateTravel
   * @returns {Promise<ChatMessage>} The created chat message
   */
  static async createChatMessage(result) {
    const distance = result.mode === 'distance' ? result.input.distance : Math.round(result.output.distance * 10) / 10;
    const content = await foundry.applications.handlebars.renderTemplate(TEMPLATES.CHAT_MESSAGE, {
      result,
      paceLabel: result.speed.paced === false ? null : CONFIG.DND5E.travelPace[result.input.pace]?.label,
      showEffects: game.settings.get(MODULE.ID, SETTINGS.SHOW_EFFECTS) && !!result.paceEffect,
      mountEmbed: result.mountUuid ? `@UUID[${result.mountUuid}]` : null,
      mountSpeed: result.mountUuid ? formatMountSpeed(result.speed, result.input.pace) : null,
      distanceText: `${distance} ${result.output.unit ?? result.input.unit}`,
      timeText: result.mode === 'distance' ? result.output.timeFormatted : formatTime(result.input.time),
      modifierLines: (result.modifiers ?? []).map((modifier) => TravelCalculator.#describeModifier(modifier))
    });
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker(), content, flags: { [MODULE.ID]: { result } } });
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
    const result = message.getFlag(MODULE.ID, 'result');
    const seconds = TravelCalculator.durationToSeconds(result?.output?.totalMinutes, result?.speed?.hours);
    if (seconds <= 0) return void ui.notifications.warn('TRAVELPACE.Advance.NoDuration', { localize: true });
    const { secondsPerMinute, minutesPerHour, hoursPerDay } = game.time.calendar.days;
    const secondsPerDay = secondsPerMinute * minutesPerHour * hoursPerDay;
    if (seconds > secondsPerDay) {
      const days = Math.floor(seconds / secondsPerDay);
      const hours = Math.round((seconds % secondsPerDay) / (secondsPerMinute * minutesPerHour));
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: 'TRAVELPACE.Advance.Confirm.Title' },
        content: `<p>${_loc('TRAVELPACE.Advance.Confirm.Content', { duration: formatTime({ days, hours, minutes: 0 }) })}</p>`
      });
      if (!confirmed) return;
    }
    await game.time.advance(seconds);
  }

  /**
   * Convert a travel duration to world-time seconds using the configured day-advance mode.
   * @param {number} totalMinutes Travel minutes from a calculation result
   * @param {number} [dayHours] Hours in the traveller's travel day
   * @returns {number} Seconds to advance world time by
   */
  static durationToSeconds(totalMinutes, dayHours = undefined) {
    if (!(totalMinutes > 0)) return 0;
    // ponytail: built from calendar.days instead of componentsToTime, which Calendaria treats as an absolute date that ignores `day`; revisit once Calendaria honours `day`
    const { secondsPerMinute, hoursPerDay } = game.time.calendar.days;
    if (game.settings.get(MODULE.ID, SETTINGS.ADVANCE_MODE) === 'travel') return Math.round(totalMinutes * secondsPerMinute);
    const { days, hours, minutes } = breakdownMinutesToTimeUnits(totalMinutes, dayHours);
    return Math.round(((days * hoursPerDay + hours) * minutesPerHour() + minutes) * secondsPerMinute);
  }
}
