import { CONST } from './config.mjs';

/**
 * Whether a movement unit states an overland distance rather than a per-round one.
 * @param {string} [unit] A `CONFIG.DND5E.movementUnits` key, as stored on `movement.units`
 * @returns {boolean} True when the unit is an overland one
 */
function isOverlandUnit(unit) {
  const config = CONFIG.DND5E?.movementUnits?.[unit];
  return !!config && config.travelResolution !== 'round';
}

/**
 * Convert distance between different units.
 * @param {number} distance Distance value
 * @param {string} fromUnit Source unit ('ft', 'm', 'km', 'mi')
 * @param {string} toUnit Target unit ('ft', 'm', 'km', 'mi')
 * @returns {number} Converted distance
 */
function convertDistance(distance, fromUnit, toUnit) {
  if (fromUnit === toUnit) return distance;
  const toFeet = { ft: 1, m: 1 / CONST.conversion.mPerFt, km: CONST.conversion.ftPerKm, mi: CONST.conversion.ftPerMile };
  const fromFeet = { ft: 1, m: CONST.conversion.mPerFt, km: 1 / CONST.conversion.ftPerKm, mi: 1 / CONST.conversion.ftPerMile };
  return distance * toFeet[fromUnit] * fromFeet[toUnit];
}

/**
 * Calculate travel time based on distance and pace.
 * @param {number} distance Distance in feet
 * @param {string} pace Travel pace ('fast', 'normal', 'slow')
 * @param {MountSpeed} speed Mount speed, as read by getMountSpeed
 * @param {number} [extraMultiplier] Combined multiplier from weather and registered contributors
 * @returns {{minutes: number, hours: number, days: number}|null} Time breakdown, or null when the mount cannot travel
 */
export function calculateTime(distance, pace, speed = { ratio: 1 }, extraMultiplier = 1) {
  const paceMultiplier = CONST.multipliers[pace] || 1;
  if (speed.perHour !== undefined) {
    const speedPerHour = speed.perHour * paceMultiplier * extraMultiplier;
    if (!(speedPerHour > 0)) return null;
    const distanceInUnit = convertDistance(distance, 'ft', speed.unit);
    return breakdownMinutesToTimeUnits((distanceInUnit / speedPerHour) * CONST.timeUnits.minutesPerHour);
  }
  const milesPerDay = CONST.milesPerDay[pace];
  if (milesPerDay === undefined) return breakdownMinutesToTimeUnits(0);
  const dayFraction = distance / (milesPerDay * CONST.conversion.ftPerMile) / (speed.ratio * extraMultiplier);
  if (!Number.isFinite(dayFraction)) return null;
  return breakdownMinutesToTimeUnits(dayFraction * CONST.timeUnits.minutesPerDay);
}

/**
 * Break a raw minute total down into days/hours/minutes by full-day length.
 * @param {number} totalMinutes Raw minute total
 * @returns {{minutes: number, hours: number, days: number}} Time breakdown
 */
function breakdownMinutesToTimeUnits(totalMinutes) {
  const days = Math.floor(totalMinutes / CONST.timeUnits.minutesPerDay);
  const remainingMinutes = totalMinutes % CONST.timeUnits.minutesPerDay;
  const hours = Math.floor(remainingMinutes / CONST.timeUnits.minutesPerHour);
  const minutes = Math.floor(remainingMinutes % CONST.timeUnits.minutesPerHour);
  return { minutes, hours, days };
}

/**
 * Calculate travel distance based on time and pace.
 * @param {number} minutes Time in minutes
 * @param {string} pace Travel pace ('fast', 'normal', 'slow')
 * @param {MountSpeed} speed Mount speed, as read by getMountSpeed
 * @param {number} [extraMultiplier] Combined multiplier from weather and registered contributors
 * @returns {{miles: number, kilometers: number}} Distance in miles and kilometers
 */
export function calculateDistance(minutes, pace, speed = { ratio: 1 }, extraMultiplier = 1) {
  const paceMultiplier = CONST.multipliers[pace] || 1;
  if (speed.perHour !== undefined) {
    const travelled = speed.perHour * paceMultiplier * extraMultiplier * (minutes / CONST.timeUnits.minutesPerHour);
    if (speed.unit === 'mi') return { miles: travelled, kilometers: travelled * CONST.conversion.miToKm };
    return { miles: travelled * CONST.conversion.kmToMi, kilometers: travelled };
  }
  const milesPerDay = CONST.milesPerDay[pace];
  if (milesPerDay === undefined) return { miles: 0, kilometers: 0 };
  const miles = milesPerDay * (minutes / CONST.timeUnits.minutesPerDay) * speed.ratio * extraMultiplier;
  return { miles, kilometers: miles * CONST.conversion.miToKm };
}

/**
 * Format a time breakdown for display, normalizing into years/months/weeks/days/hours/minutes.
 * @param {{minutes: number, hours: number, days: number}} timeData Time data from calculateTime
 * @returns {string} Localized formatted time string
 */
export function formatTime(timeData) {
  if (!timeData) return _loc('TravelPace.Time.Immobile');
  let { minutes, hours, days } = timeData;
  if (minutes >= 59.5) {
    minutes = 0;
    hours += 1;
  } else minutes = Math.round(minutes);
  if (hours >= CONST.timeUnits.hoursPerDay) {
    days += Math.floor(hours / CONST.timeUnits.hoursPerDay);
    hours %= CONST.timeUnits.hoursPerDay;
  }
  const weeks = Math.floor(days / 7);
  days %= 7;
  const months = Math.floor(weeks / 4);
  const remainingWeeks = weeks % 4;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const pluralSuffix = _loc('TravelPace.Units.Plural.Suffix');
  const parts = [];
  const push = (value, key) => {
    if (value <= 0) return;
    const label = _loc(key);
    const finalLabel = value > 1 ? label + pluralSuffix : label;
    parts.push(`${value} ${finalLabel.toLowerCase()}`);
  };
  push(years, 'DND5E.UNITS.TIME.Year.Label');
  push(remainingMonths, 'DND5E.UNITS.TIME.Month.Label');
  push(remainingWeeks, 'DND5E.UNITS.TIME.Week.Label');
  push(days, 'DND5E.UNITS.TIME.Day.Label');
  push(hours, 'DND5E.UNITS.TIME.Hour.Label');
  push(minutes, 'DND5E.UNITS.TIME.Minute.Label');
  return parts.length ? parts.join(_loc('TravelPace.Time.Format.Separator')) : _loc('TravelPace.Time.NoTime');
}

/**
 * Whether Calendaria is installed and active, guarding access to its global namespace.
 * @returns {boolean} True when the CALENDARIA global is safe to read
 */
export function isCalendariaActive() {
  return !!game.modules.get('calendaria')?.active;
}

/**
 * Get Calendaria's named weather severity bands, ascending.
 * @returns {Array<{id: string, label: string}>} Band descriptors, empty without Calendaria
 */
export function getSeverityLevels() {
  if (!isCalendariaActive()) return [];
  return CALENDARIA.api.getWeatherSeverityLevels().map((level) => ({ id: level.id, label: _loc(level.label) }));
}

/**
 * @typedef {{perHour: number, unit: string}|{ratio: number}} MountSpeed
 * A vehicle's own speed per hour in its stated unit, or a walking mount's speed as a ratio of the
 * 30 ft baseline the travel table assumes.
 */

/**
 * Read a mount's travel speed off its movement data.
 * @param {foundry.documents.Actor|null} mount The resolved mount or vehicle actor
 * @returns {MountSpeed} The mount's speed, or an unmodified ratio when there is no mount
 */
export function getMountSpeed(mount) {
  if (!mount) return { ratio: 1 };
  const movement = mount.system?.attributes?.movement ?? {};
  if (mount.type === 'vehicle' && isOverlandUnit(movement.units)) {
    const speeds = Object.entries(movement)
      .filter(([key, value]) => typeof value === 'number' && key !== 'units')
      .map(([, value]) => value);
    if (speeds.length) return { perHour: Math.max(...speeds), unit: movement.units };
  }
  return { ratio: (movement.walk || 0) / CONST.walkBaselineFeet };
}

/**
 * Format a mount's speed for display, adjusted by the selected pace.
 * @param {MountSpeed} speed Mount speed, as read by getMountSpeed
 * @param {string} pace Travel pace id
 * @param {boolean} useMetric Whether the world is configured for metric units
 * @returns {string} Localized speed text
 */
export function formatMountSpeed(speed, pace, useMetric) {
  const paceMultiplier = CONST.multipliers[pace] || 1;
  if (speed.perHour !== undefined) {
    const targetUnit = useMetric ? 'km' : 'mi';
    const converted = convertDistance(speed.perHour, speed.unit, targetUnit);
    const abbreviation = _loc(useMetric ? 'DND5E.DistKmAbbr' : 'DND5E.DistMiAbbr');
    return _loc('TravelPace.Speed.Format.PerHour', { speed: (converted * paceMultiplier).toFixed(1), unit: abbreviation });
  }
  const feetPerMinute = speed.ratio * CONST.walkBaselineFeet * paceMultiplier;
  const abbreviation = _loc(useMetric ? 'DND5E.DistMAbbr' : 'DND5E.DistFtAbbr');
  const displayed = useMetric ? Math.round(feetPerMinute * CONST.conversion.mPerFt) : Math.round(feetPerMinute);
  return _loc('TravelPace.Speed.Format.PerMinute', { speed: displayed, unit: abbreviation });
}

/**
 * Resolve a mount from the key the settings store.
 * @param {string} [key] The stored mount key
 * @returns {Promise<foundry.documents.Actor|null>} The resolved actor
 */
export async function resolveMount(key) {
  if (!key) return null;
  return (await fromUuid(key.includes('.') ? key : `Actor.${key}`)) ?? null;
}

/**
 * Get the localized pace effects description.
 * @param {string} pace The travel pace ('fast', 'normal', 'slow')
 * @returns {string} Localized description of the pace's mechanical effects
 */
export function getPaceEffects(pace) {
  return _loc(`TravelPace.Effects.${pace.charAt(0).toUpperCase()}${pace.slice(1)}`);
}
