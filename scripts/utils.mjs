import { MODULE, SETTINGS, TRAVEL } from './constants.mjs';

/**
 * @typedef {{perHour: number, unit: string}|{ratio: number}} MountSpeed
 * A vehicle's own travel speed in a `CONFIG.DND5E.travelUnits` key, or a walking mount's speed as a
 * ratio of the baseline the pace table assumes.
 */

/** @type {Object<string, string>} The length unit each travel unit measures distance in. */
const TRAVEL_TO_LENGTH = { mph: 'mi', kph: 'km' };

/**
 * The pace configuration for an id, falling back to normal so an unknown pace travels rather than stalling.
 * @param {string} pace Travel pace id
 * @returns {object} An entry of `CONFIG.DND5E.travelPace`
 */
function paceConfig(pace) {
  return CONFIG.DND5E.travelPace[pace] ?? CONFIG.DND5E.travelPace.normal;
}

/**
 * Minutes in an hour, read from the world calendar so a custom one is honoured.
 * @returns {number} Minutes per hour
 */
export function minutesPerHour() {
  return game.time.calendar?.days?.minutesPerHour ?? 60;
}

/**
 * Minutes in a travel day. How many hours a party marches is a rule the system states; how long an
 * hour lasts is the world calendar's business.
 * @returns {number} Minutes per travel day
 */
export function minutesPerTravelDay() {
  return (CONFIG.DND5E.travelTimes?.group ?? 8) * minutesPerHour();
}

/**
 * Combat rounds in a minute, for reading a per-round walking speed as a per-minute one. A round is
 * a fixed span of seconds, so a calendar with longer minutes fits more of them in.
 * @returns {number} Rounds per minute
 */
function roundsPerMinute() {
  const secondsPerMinute = game.time.calendar?.days?.secondsPerMinute ?? 60;
  return secondsPerMinute / (CONFIG.time.roundTime || 6);
}

/**
 * The travel and length units the world measures in, following the system's metric setting.
 * @returns {{travel: string, length: string}} A `CONFIG.DND5E.travelUnits` key and its length unit
 */
export function travelUnits() {
  const travel = dnd5e.utils.defaultUnits('travel') ?? 'mph';
  return { travel, length: TRAVEL_TO_LENGTH[travel] ?? 'mi' };
}

/**
 * The localized abbreviation for a `CONFIG.DND5E.movementUnits` key.
 * @param {string} unit Movement unit key
 * @returns {string} Localized abbreviation
 */
export function unitAbbreviation(unit) {
  return CONFIG.DND5E.movementUnits[unit]?.abbreviation ?? unit;
}

/**
 * Read a mount's travel speed. Vehicles carry a prepared travel block; everything else is measured
 * against the walking baseline.
 * @param {foundry.documents.Actor|null} mount The resolved mount or vehicle actor
 * @returns {MountSpeed} The mount's speed, or an unmodified ratio when there is no mount
 */
export function getMountSpeed(mount) {
  if (!mount) return { ratio: 1 };
  const travel = mount.system?.attributes?.travel;
  if (travel?.speeds?.max) return { perHour: travel.speeds.max, unit: travel.units };
  const movement = mount.system?.attributes?.movement ?? {};
  const walkFeet = dnd5e.utils.convertLength(movement.walk || 0, movement.units ?? 'ft', 'ft', { strict: false });
  return { ratio: walkFeet / TRAVEL.WALK_BASELINE_FEET };
}

/**
 * Read the speed of whatever the party is travelling as.
 * @param {foundry.documents.Actor|null} actor A creature, vehicle or group actor
 * @returns {MountSpeed} The speed to travel at
 */
export function getTravellerSpeed(actor) {
  if (actor?.type !== 'group') return getMountSpeed(actor);
  const stated = getMountSpeed(actor);
  if (distancePerMinute('normal', stated) > 0) return stated;
  const members = (actor.system?.members ?? []).map((member) => member.actor).filter((member) => member?.system?.isCreature);
  if (!members.length) return stated;
  return members.map(getMountSpeed).reduce((slower, speed) => (distancePerMinute('normal', speed) < distancePerMinute('normal', slower) ? speed : slower));
}

/**
 * Format a mount's speed for display, adjusted by the selected pace.
 * @param {MountSpeed} speed Mount speed, as read by getMountSpeed
 * @param {string} pace Travel pace id
 * @returns {string} Localized speed text
 */
export function formatMountSpeed(speed, pace) {
  const { multiplier } = paceConfig(pace);
  const units = travelUnits();
  if (speed.perHour !== undefined) {
    const { value } = dnd5e.utils.convertTravelSpeed(speed.perHour, speed.unit, { to: units.travel });
    return _loc('TRAVELPACE.Speed.Format.PerHour', { speed: (value * multiplier).toFixed(1), unit: unitAbbreviation(units.length) });
  }
  const feetPerMinute = speed.ratio * TRAVEL.WALK_BASELINE_FEET * roundsPerMinute() * multiplier;
  const unit = units.length === 'km' ? 'm' : 'ft';
  return _loc('TRAVELPACE.Speed.Format.PerMinute', { speed: Math.round(dnd5e.utils.convertLength(feetPerMinute, 'ft', unit, { strict: false })), unit: unitAbbreviation(unit) });
}

/**
 * The distance a mount covers per minute of travel, in the world's travel unit.
 * @param {string} pace Travel pace id
 * @param {MountSpeed} speed Mount speed, as read by getMountSpeed
 * @param {number} [extraMultiplier] Combined multiplier from weather and registered contributors
 * @returns {number} Distance per minute, or 0 when the mount cannot travel
 */
export function distancePerMinute(pace, speed, extraMultiplier = 1) {
  const config = paceConfig(pace);
  const { travel } = travelUnits();
  const perMinute =
    speed.perHour !== undefined
      ? (dnd5e.utils.convertTravelSpeed(speed.perHour, speed.unit, { to: travel }).value * config.multiplier) / minutesPerHour()
      : (dnd5e.utils.convertTravelSpeed(config.standard, 'mph', { to: travel }).value * speed.ratio) / minutesPerTravelDay();
  const total = perMinute * extraMultiplier;
  return total > 0 ? total : 0;
}

/**
 * Calculate how long a distance takes to travel.
 * @param {number} distance Distance in the world's travel unit
 * @param {string} pace Travel pace id
 * @param {MountSpeed} speed Mount speed, as read by getMountSpeed
 * @param {number} [extraMultiplier] Combined multiplier from weather and registered contributors
 * @returns {{minutes: number, hours: number, days: number}|null} Time breakdown, or null when the mount cannot travel
 */
export function calculateTime(distance, pace, speed = { ratio: 1 }, extraMultiplier = 1) {
  const perMinute = distancePerMinute(pace, speed, extraMultiplier);
  if (!perMinute) return null;
  return breakdownMinutesToTimeUnits(distance / perMinute);
}

/**
 * Calculate how far a span of travel covers.
 * @param {number} minutes Travel minutes
 * @param {string} pace Travel pace id
 * @param {MountSpeed} speed Mount speed, as read by getMountSpeed
 * @param {number} [extraMultiplier] Combined multiplier from weather and registered contributors
 * @returns {number} Distance in the world's travel unit
 */
export function calculateDistance(minutes, pace, speed = { ratio: 1 }, extraMultiplier = 1) {
  return distancePerMinute(pace, speed, extraMultiplier) * minutes;
}

/**
 * Total the minutes in a day/hour/minute breakdown.
 * @param {object} [time] Time components
 * @param {number} [time.days] Travel days
 * @param {number} [time.hours] Hours
 * @param {number} [time.minutes] Minutes
 * @returns {number} Total travel minutes
 */
export function timeToMinutes({ days = 0, hours = 0, minutes = 0 } = {}) {
  return days * minutesPerTravelDay() + hours * minutesPerHour() + minutes;
}

/**
 * Break a minute total down into travel days, hours and minutes.
 * @param {number} totalMinutes Raw minute total
 * @returns {{minutes: number, hours: number, days: number}} Time breakdown
 */
export function breakdownMinutesToTimeUnits(totalMinutes) {
  const rounded = Math.round(totalMinutes);
  const remainder = rounded % minutesPerTravelDay();
  return { days: Math.floor(rounded / minutesPerTravelDay()), hours: Math.floor(remainder / minutesPerHour()), minutes: remainder % minutesPerHour() };
}

/**
 * Format a time breakdown for display.
 * @param {{minutes: number, hours: number, days: number}|null} timeData Time data from calculateTime
 * @returns {string} Localized formatted time
 */
export function formatTime(timeData) {
  if (!timeData) return _loc('TRAVELPACE.Time.Immobile');
  const parts = [];
  if (timeData.days > 0) parts.push(dnd5e.utils.formatTime(timeData.days, 'day'));
  if (timeData.hours > 0) parts.push(dnd5e.utils.formatTime(timeData.hours, 'hour'));
  if (timeData.minutes > 0) parts.push(dnd5e.utils.formatTime(timeData.minutes, 'minute'));
  return parts.length ? game.i18n.getListFormatter().format(parts) : _loc('TRAVELPACE.Time.NoTime');
}

/**
 * The localized description of a pace's mechanical effects.
 * @param {string} pace Travel pace id
 * @returns {string} Localized description
 */
export function getPaceEffects(pace) {
  return _loc(`TRAVELPACE.Effects.${pace.charAt(0).toUpperCase()}${pace.slice(1)}`);
}

/**
 * The UUIDs of every mount the GM has enabled.
 * @returns {string[]} Enabled mount UUIDs
 */
export function getEnabledMountUuids() {
  const stored = game.settings.get(MODULE.ID, SETTINGS.ENABLED_MOUNTS);
  if (Array.isArray(stored)) return stored;
  return Object.entries(stored ?? {})
    .filter(([, enabled]) => enabled)
    .map(([uuid]) => uuid);
}

/**
 * Resolve a mount from its stored UUID.
 * @param {string} [uuid] The stored mount UUID
 * @returns {Promise<foundry.documents.Actor|null>} The resolved actor
 */
export async function resolveMount(uuid) {
  if (!uuid) return null;
  return (await fromUuid(uuid)) ?? null;
}
