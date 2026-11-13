import { TravelPaceApp } from './apps/calculator.mjs';
import { MODULE } from './constants.mjs';
import { TravelCalculator } from './travel-calculator.mjs';

/**
 * @typedef {object} TravelInput
 * @property {'distance'|'time'} mode - Whether a distance or a time budget is being converted
 * @property {string} pace - A `CONFIG.DND5E.travelPace` id. A group with a slowed member is held to slow pace
 * @property {string} [travelType] - A `CONFIG.DND5E.travelTypes` id, defaulting to the traveller's fastest medium
 * @property {number} [distance] - Distance in the world's travel unit, required in distance mode
 * @property {object} [time] - Time budget, required in time mode
 * @property {number} [time.days] - Travel days, each as long as the traveller's hours per travel day
 * @property {number} [time.hours] - Hours
 * @property {number} [time.minutes] - Minutes
 * @property {foundry.documents.Actor|null} [mount] - A resolved mount or vehicle actor
 */

/**
 * @typedef {object} TravelResult
 * @property {'distance'|'time'} mode - The mode the calculation ran in
 * @property {object} input - The distance or time the calculation started from, plus the pace travelled at
 * @property {object} output - `totalMinutes` always, plus `timeFormatted` and `time` in distance mode or `distance` in time mode
 * @property {string} paceEffect - Localized description of the pace's mechanical effects, empty when pace does not apply
 * @property {boolean} paceSlowed - Whether a slowed group member held the group to slow pace
 * @property {object} speed - The traveller's speed in the chosen medium, with its `type`, `hours` per travel day and whether it is `paced`
 * @property {Array<{id: string, label: string, multiplier: number}>} modifiers - Labeled multipliers applied
 * @property {number} extraMultiplier - The product of every modifier
 * @property {string|null} mountUuid - UUID of the mount used, for re-resolving from a chat flag
 */

/**
 * Publish the travel API on the module entry and on the global namespace other 3DS modules read.
 * @returns {void}
 */
export function exposeApi() {
  const api = {
    /**
     * The distance unit abbreviation the world is configured for.
     * @returns {string} Localized unit abbreviation
     */
    get unit() {
      return TravelCalculator.unit;
    },

    /**
     * Calculate a journey without posting anything.
     * @param {TravelInput} data Calculator input payload
     * @returns {TravelResult|null} The result, or null when a `travelPace.preCalculate` listener cancelled it
     */
    calculateTravel: (data) => TravelCalculator.calculateTravel(data),

    /**
     * Calculate a journey and post it to chat, firing `travelPace.calculated`.
     * @param {TravelInput} data Calculator input payload
     * @returns {Promise<TravelResult|null>} The result, or null when a listener cancelled it
     */
    submitCalculation: (data) => TravelCalculator.submitCalculation(data),

    /**
     * Post an already-calculated result to chat.
     * @param {TravelResult} result A result from calculateTravel
     * @returns {Promise<ChatMessage>} The created message
     */
    createChatMessage: (result) => TravelCalculator.createChatMessage(result),

    /**
     * Convert travel minutes to world-time seconds, honouring the day-advance setting.
     * @param {number} totalMinutes Travel minutes
     * @param {number} [dayHours] Hours in the traveller's travel day, as on a result's `speed.hours`
     * @returns {number} Seconds, or 0 when there is nothing to advance
     */
    durationToSeconds: (totalMinutes, dayHours) => TravelCalculator.durationToSeconds(totalMinutes, dayHours),

    /**
     * Open the calculator, or bring the open one forward.
     * @returns {void}
     */
    openCalculator: () => TravelPaceApp.show()
  };

  game.modules.get(MODULE.ID).api = api;
  globalThis.TRAVELPACE = api;
}
