import { CONST } from './config.js';

/**
 * Convert distance between different units
 * @param {number} distance - Distance value
 * @param {string} fromUnit - Source unit ('ft', 'm', 'km', 'mi')
 * @param {string} toUnit - Target unit ('ft', 'm', 'km', 'mi')
 * @returns {number} - Converted distance
 */
export function convertDistance(distance, fromUnit, toUnit) {
  try {
    if (fromUnit === toUnit) return distance;
    const toFeet = { ft: 1, m: 1 / CONST.conversion.mPerFt, km: CONST.conversion.ftPerKm, mi: CONST.conversion.ftPerMile };
    const fromFeet = { ft: 1, m: CONST.conversion.mPerFt, km: 1 / CONST.conversion.ftPerKm, mi: 1 / CONST.conversion.ftPerMile };
    const feet = distance * toFeet[fromUnit];
    return feet * fromFeet[toUnit];
  } catch (error) {
    console.error('TravelPace | Error in convertDistance:', error);
    return distance;
  }
}

/**
 * Calculate travel time based on distance and pace
 * @param {number} distance - Distance in feet
 * @param {string} pace - Travel pace ('fast', 'normal', 'slow')
 * @param {number|string} speedModifier - Speed modifier or direct speed
 * @returns {Object} - Time breakdown
 */
export function calculateTime(distance, pace, speedModifier = 1) {
  try {
    if (typeof speedModifier === 'string' && speedModifier.includes('/hour')) return calculateTimeWithVehicleSpeed(distance, pace, speedModifier);
    const milesPerDay = CONST.milesPerDay[pace];
    if (milesPerDay === undefined) {
      console.warn(`TravelPace | Invalid pace provided: ${pace}`);
      return breakdownMinutesToTimeUnits(0);
    }
    const feetPerDay = milesPerDay * CONST.conversion.ftPerMile;
    const dayFraction = (distance / feetPerDay) * (1 / speedModifier);
    const totalMinutes = dayFraction * CONST.timeUnits.minutesPerDay;
    return breakdownMinutesToTimeUnits(totalMinutes);
  } catch (error) {
    console.error('TravelPace | Error in calculateTime:', error);
    return breakdownMinutesToTimeUnits(0);
  }
}

/**
 * Calculate time using vehicle speed notation
 * @param {number} distance - Distance in feet
 * @param {string} pace - Travel pace ('fast', 'normal', 'slow')
 * @param {string} speedNotation - Speed in format "X mi/hour" or "X km/hour"
 * @returns {Object} - Time breakdown
 * @private
 */
function calculateTimeWithVehicleSpeed(distance, pace, speedNotation) {
  try {
    const hourUnit = game.i18n.localize('TravelPace.Speed.Units.Hour');
    const miAbbrev = game.i18n.localize('DND5E.DistMiAbbr');
    const kmAbbrev = game.i18n.localize('DND5E.DistKmAbbr');
    const ftAbbrev = game.i18n.localize('DND5E.DistFtAbbr');
    const speedRegex = new RegExp(`^(\\d+(\\.\\d+)?)\\s*(${miAbbrev}|${kmAbbrev})/${hourUnit}$`);
    const speedMatch = speedNotation.match(speedRegex);
    if (!speedMatch) return breakdownMinutesToTimeUnits(0);
    const baseSpeed = parseFloat(speedMatch[1]);
    const unit = speedMatch[3];
    const paceMultiplier = CONST.multipliers[pace] || 1;
    const adjustedSpeed = baseSpeed * paceMultiplier;
    const distanceInUnit = convertDistance(distance, ftAbbrev, unit === miAbbrev ? miAbbrev : kmAbbrev);
    const totalHours = distanceInUnit / adjustedSpeed;
    const totalMinutes = totalHours * CONST.timeUnits.minutesPerHour;
    return breakdownMinutesToTimeUnits(totalMinutes);
  } catch (error) {
    console.error('TravelPace | Error in calculateTimeWithVehicleSpeed:', error);
    return breakdownMinutesToTimeUnits(0);
  }
}

/**
 * Break down minutes into days, hours, and minutes
 * @param {number} totalMinutes - Total minutes
 * @returns {Object} - Time breakdown
 * @private
 */
function breakdownMinutesToTimeUnits(totalMinutes) {
  try {
    const days = Math.floor(totalMinutes / CONST.timeUnits.minutesPerDay);
    const remainingMinutes = totalMinutes % CONST.timeUnits.minutesPerDay;
    const hours = Math.floor(remainingMinutes / CONST.timeUnits.minutesPerHour);
    const minutes = Math.floor(remainingMinutes % CONST.timeUnits.minutesPerHour);
    return { totalMinutes, minutes, hours, days };
  } catch (error) {
    console.error('TravelPace | Error in breakdownMinutesToTimeUnits:', error);
    return { totalMinutes: 0, minutes: 0, hours: 0, days: 0 };
  }
}

/**
 * Calculate travel distance based on time and pace
 * @param {number} minutes - Time in minutes
 * @param {string} pace - Travel pace ('fast', 'normal', 'slow')
 * @param {number|string} speedModifier - Modifier or direct speed
 * @returns {Object} - Distance in different units
 */
export function calculateDistance(minutes, pace, speedModifier = 1) {
  try {
    if (typeof speedModifier === 'string' && speedModifier.includes('/hour')) return calculateDistanceWithVehicleSpeed(minutes, pace, speedModifier); // LOCALIZE
    const dayFraction = minutes / CONST.timeUnits.minutesPerDay;
    const milesPerDay = CONST.milesPerDay[pace];
    if (milesPerDay === undefined) {
      console.warn(`TravelPace | Invalid pace provided: ${pace}`);
      return { miles: 0, feet: 0, kilometers: 0, meters: 0 };
    }
    const miles = milesPerDay * dayFraction * speedModifier;
    return { miles, feet: miles * CONST.conversion.ftPerMile, kilometers: miles * CONST.conversion.miToKm, meters: miles * CONST.conversion.ftPerMile * CONST.conversion.mPerFt };
  } catch (error) {
    console.error('TravelPace | Error in calculateDistance:', error);
    return { miles: 0, feet: 0, kilometers: 0, meters: 0 };
  }
}

/**
 * Calculate distance using vehicle speed notation
 * @param {number} minutes - Time in minutes
 * @param {string} pace - Travel pace ('fast', 'normal', 'slow')
 * @param {string} speedNotation - Speed in format "X mi/hour" or "X km/hour"
 * @returns {Object} - Distance in different units
 * @private
 */
function calculateDistanceWithVehicleSpeed(minutes, pace, speedNotation) {
  try {
    const hourUnit = game.i18n.localize('TravelPace.Speed.Units.Hour');
    const miAbbrev = game.i18n.localize('DND5E.DistMiAbbr');
    const kmAbbrev = game.i18n.localize('DND5E.DistKmAbbr');
    const speedRegex = new RegExp(`^(\\d+(\\.\\d+)?)\\s*(${miAbbrev}|${kmAbbrev})/${hourUnit}$`);
    const speedMatch = speedNotation.match(speedRegex);
    if (!speedMatch) {
      console.warn(`TravelPace | Invalid speed notation: ${speedNotation}`);
      return { miles: 0, feet: 0, kilometers: 0, meters: 0 };
    }
    const baseSpeed = parseFloat(speedMatch[1]);
    const unit = speedMatch[3];
    const paceMultiplier = CONST.multipliers[pace] || 1;
    const adjustedSpeed = baseSpeed * paceMultiplier;
    const hours = minutes / CONST.timeUnits.minutesPerHour;
    const directDistance = adjustedSpeed * hours;
    if (unit === miAbbrev) {
      return {
        miles: directDistance,
        feet: directDistance * CONST.conversion.ftPerMile,
        kilometers: directDistance * CONST.conversion.miToKm,
        meters: directDistance * CONST.conversion.ftPerMile * CONST.conversion.mPerFt
      };
    } else {
      return {
        kilometers: directDistance,
        meters: directDistance * 1000,
        feet: directDistance * CONST.conversion.ftPerKm,
        miles: directDistance * CONST.conversion.kmToMi
      };
    }
  } catch (error) {
    console.error('TravelPace | Error in calculateDistanceWithVehicleSpeed:', error);
    return { miles: 0, feet: 0, kilometers: 0, meters: 0 };
  }
}

/**
 * Format time for display
 * @param {Object} timeData - Time data from calculateTime
 * @returns {string} - Formatted time string
 */
export function formatTime(timeData) {
  if (!timeData) return game.i18n.localize('TravelPace.Time.NoTime');
  try {
    let { minutes, hours, days } = timeData;
    if (minutes >= 59.5) {
      minutes = 0;
      hours += 1;
    } else {
      minutes = Math.round(minutes);
    }
    if (hours >= 8) {
      const additionalDays = Math.floor(hours / 8);
      days += additionalDays;
      hours %= 8;
    }
    const weeks = Math.floor(days / 7);
    days %= 7;
    const months = Math.floor(weeks / 4);
    const remainingWeeks = weeks % 4;
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    const parts = [];
    const pluralSuffix = game.i18n.localize('TravelPace.Units.Plural.Suffix');
    if (years > 0) {
      const yearLabel = game.i18n.localize('DND5E.UNITS.TIME.Year.Label');
      const finalLabel = years > 1 ? yearLabel + pluralSuffix : yearLabel;
      parts.push(`${years} ${finalLabel.toLowerCase()}`);
    }
    if (remainingMonths > 0) {
      const monthLabel = game.i18n.localize('DND5E.UNITS.TIME.Month.Label');
      const finalLabel = remainingMonths > 1 ? monthLabel + pluralSuffix : monthLabel;
      parts.push(`${remainingMonths} ${finalLabel.toLowerCase()}`);
    }
    if (remainingWeeks > 0) {
      const weekLabel = game.i18n.localize('DND5E.UNITS.TIME.Week.Label');
      const finalLabel = remainingWeeks > 1 ? weekLabel + pluralSuffix : weekLabel;
      parts.push(`${remainingWeeks} ${finalLabel.toLowerCase()}`);
    }
    if (days > 0) {
      const dayLabel = game.i18n.localize('DND5E.UNITS.TIME.Day.Label');
      const finalLabel = days > 1 ? dayLabel + pluralSuffix : dayLabel;
      parts.push(`${days} ${finalLabel.toLowerCase()}`);
    }
    if (hours > 0) {
      const hourLabel = game.i18n.localize('DND5E.UNITS.TIME.Hour.Label');
      const finalLabel = hours > 1 ? hourLabel + pluralSuffix : hourLabel;
      parts.push(`${hours} ${finalLabel.toLowerCase()}`);
    }
    if (minutes > 0) {
      const minuteLabel = game.i18n.localize('DND5E.UNITS.TIME.Minute.Label');
      const finalLabel = minutes > 1 ? minuteLabel + pluralSuffix : minuteLabel;
      parts.push(`${minutes} ${finalLabel.toLowerCase()}`);
    }
    return parts.length > 0 ? parts.join(game.i18n.localize('TravelPace.Time.Format.Separator')) : game.i18n.localize('TravelPace.Time.NoTime');
  } catch (error) {
    console.error('TravelPace | Error in formatTime:', error);
    return game.i18n.localize('TravelPace.Time.NoTime');
  }
}

/**
 * Get the movement speed for a mount or vehicle
 * @param {string} actorId - The ID of the actor
 * @returns {number|string} - Speed modifier or direct speed value
 */
export function getMountSpeedModifier(actorId) {
  if (!actorId) return 1;
  try {
    const actor = game.actors.get(actorId);
    if (!actor) {
      if (actorId.includes('.')) return 1;
      return 1;
    }
    const baseSpeed = 30;
    if (actor.type === 'vehicle') {
      const movement = actor.system.attributes?.movement || {};
      const miAbbrev = game.i18n.localize('DND5E.DistMiAbbr');
      const kmAbbrev = game.i18n.localize('DND5E.DistKmAbbr');
      if (movement.units === miAbbrev || movement.units === kmAbbrev) {
        const speeds = Object.entries(movement)
          .filter(([key, value]) => typeof value === 'number' && key !== 'units')
          .map(([key, value]) => value);
        if (speeds.length === 0) return 1;
        const speedValue = Math.max(...speeds);
        const unit = movement.units === miAbbrev ? miAbbrev : kmAbbrev;
        return game.i18n.format('TravelPace.Speed.Format.PerHour', { speed: speedValue, unit });
      }
    }
    const walkSpeed = actor.system.attributes?.movement?.walk || baseSpeed;
    return walkSpeed / baseSpeed;
  } catch (error) {
    console.error('TravelPace | Error getting mount speed modifier:', error);
    return 1;
  }
}

/**
 * Get the pace effects for display
 * @param {string} pace - The travel pace ('fast', 'normal', 'slow')
 * @returns {string} - Description of the pace effects
 */
export function getPaceEffects(pace) {
  try {
    const key = `TravelPace.Effects.${pace.charAt(0).toUpperCase() + pace.slice(1)}`;
    return game.i18n.localize(key);
  } catch (error) {
    console.error('TravelPace | Error getting pace effects:', error);
    return '';
  }
}

/**
 * Register Handlebars helpers for the module
 */
Hooks.once('init', () => {
  //TODO: Move this all to data prep
  try {
    Handlebars.registerHelper('travelpace-concat', (a, b) => a + b);
    Handlebars.registerHelper('travelpace-capitalize', (str) => str.charAt(0).toUpperCase() + str.slice(1));
    Handlebars.registerHelper('travelpace-multiply', (a, b) => a * b);
  } catch (error) {
    console.error('TravelPace | Error registering Handlebars helpers:', error);
  }
});
