import { CONST } from './config.mjs';

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
 * @param {number|string} speedModifier Pace modifier or formatted vehicle speed string
 * @returns {{minutes: number, hours: number, days: number}} Time breakdown
 */
export function calculateTime(distance, pace, speedModifier = 1) {
  if (typeof speedModifier === 'string' && speedModifier.includes('/hour')) return calculateTimeWithVehicleSpeed(distance, pace, speedModifier);
  const milesPerDay = CONST.milesPerDay[pace];
  if (milesPerDay === undefined) return breakdownMinutesToTimeUnits(0);
  const feetPerDay = milesPerDay * CONST.conversion.ftPerMile;
  const dayFraction = distance / feetPerDay / speedModifier;
  return breakdownMinutesToTimeUnits(dayFraction * CONST.timeUnits.minutesPerDay);
}

/**
 * Time variant for vehicle-speed notation ("X mi/hour" or "X km/hour").
 * @param {number} distance Distance in feet
 * @param {string} pace Travel pace id
 * @param {string} speedNotation Formatted vehicle speed string
 * @returns {{minutes: number, hours: number, days: number}} Time breakdown
 */
function calculateTimeWithVehicleSpeed(distance, pace, speedNotation) {
  const hourUnit = _loc('TravelPace.Speed.Units.Hour');
  const miAbbrev = _loc('DND5E.DistMiAbbr');
  const kmAbbrev = _loc('DND5E.DistKmAbbr');
  const ftAbbrev = _loc('DND5E.DistFtAbbr');
  const speedMatch = speedNotation.match(new RegExp(`^(\\d+(\\.\\d+)?)\\s*(${miAbbrev}|${kmAbbrev})/${hourUnit}$`));
  if (!speedMatch) return breakdownMinutesToTimeUnits(0);
  const baseSpeed = parseFloat(speedMatch[1]);
  const unit = speedMatch[3];
  const paceMultiplier = CONST.multipliers[pace] || 1;
  const adjustedSpeed = baseSpeed * paceMultiplier;
  const distanceInUnit = convertDistance(distance, ftAbbrev, unit === miAbbrev ? miAbbrev : kmAbbrev);
  const totalMinutes = (distanceInUnit / adjustedSpeed) * CONST.timeUnits.minutesPerHour;
  return breakdownMinutesToTimeUnits(totalMinutes);
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
 * @param {number|string} speedModifier Pace modifier or formatted vehicle speed string
 * @returns {{miles: number, kilometers: number}} Distance in miles and kilometers
 */
export function calculateDistance(minutes, pace, speedModifier = 1) {
  if (typeof speedModifier === 'string' && speedModifier.includes('/hour')) return calculateDistanceWithVehicleSpeed(minutes, pace, speedModifier);
  const dayFraction = minutes / CONST.timeUnits.minutesPerDay;
  const milesPerDay = CONST.milesPerDay[pace];
  if (milesPerDay === undefined) return { miles: 0, kilometers: 0 };
  const miles = milesPerDay * dayFraction * speedModifier;
  return { miles, kilometers: miles * CONST.conversion.miToKm };
}

/**
 * Distance variant for vehicle-speed notation ("X mi/hour" or "X km/hour").
 * @param {number} minutes Time in minutes
 * @param {string} pace Travel pace id
 * @param {string} speedNotation Formatted vehicle speed string
 * @returns {{miles: number, kilometers: number}} Distance in miles and kilometers
 */
function calculateDistanceWithVehicleSpeed(minutes, pace, speedNotation) {
  const hourUnit = _loc('TravelPace.Speed.Units.Hour');
  const miAbbrev = _loc('DND5E.DistMiAbbr');
  const kmAbbrev = _loc('DND5E.DistKmAbbr');
  const speedMatch = speedNotation.match(new RegExp(`^(\\d+(\\.\\d+)?)\\s*(${miAbbrev}|${kmAbbrev})/${hourUnit}$`));
  if (!speedMatch) return { miles: 0, kilometers: 0 };
  const baseSpeed = parseFloat(speedMatch[1]);
  const paceMultiplier = CONST.multipliers[pace] || 1;
  const dirDistance = baseSpeed * paceMultiplier * (minutes / CONST.timeUnits.minutesPerHour);
  if (speedMatch[3] === miAbbrev) return { miles: dirDistance, kilometers: dirDistance * CONST.conversion.miToKm };
  return { miles: dirDistance * CONST.conversion.kmToMi, kilometers: dirDistance };
}

/**
 * Format a time breakdown for display, normalizing into years/months/weeks/days/hours/minutes.
 * @param {{minutes: number, hours: number, days: number}} timeData Time data from calculateTime
 * @returns {string} Localized formatted time string
 */
export function formatTime(timeData) {
  if (!timeData) return _loc('TravelPace.Time.NoTime');
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
 * Get the movement speed for a mount or vehicle.
 * @param {string} actorId The id (or UUID) of the actor
 * @returns {number|string} A pace modifier ratio or a formatted vehicle speed string ("X mi/hour")
 */
export function getMountSpeedModifier(actorId) {
  if (!actorId) return 1;
  const actor = game.actors.get(actorId);
  if (!actor) return 1;
  const baseSpeed = 30;
  if (actor.type === 'vehicle') {
    const movement = actor.system.attributes?.movement || {};
    const miAbbrev = _loc('DND5E.DistMiAbbr');
    const kmAbbrev = _loc('DND5E.DistKmAbbr');
    if (movement.units === miAbbrev || movement.units === kmAbbrev) {
      const speeds = Object.entries(movement)
        .filter(([key, value]) => typeof value === 'number' && key !== 'units')
        .map(([, value]) => value);
      if (!speeds.length) return 1;
      const unit = movement.units === miAbbrev ? miAbbrev : kmAbbrev;
      return _loc('TravelPace.Speed.Format.PerHour', { speed: Math.max(...speeds), unit });
    }
  }
  const walkSpeed = actor.system.attributes?.movement?.walk || baseSpeed;
  return walkSpeed / baseSpeed;
}

/**
 * Get the localized pace effects description.
 * @param {string} pace The travel pace ('fast', 'normal', 'slow')
 * @returns {string} Localized description of the pace's mechanical effects
 */
export function getPaceEffects(pace) {
  return _loc(`TravelPace.Effects.${pace.charAt(0).toUpperCase()}${pace.slice(1)}`);
}
