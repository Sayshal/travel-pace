import { CONST } from './config.js';

/**
 * Helper functions for the Travel Pace Calculator module
 * @module travel-pace/helpers
 */

/**
 * Convert between different distance units
 * @param {number} value - The value to convert
 * @param {string} from - The unit to convert from ('ft', 'm', 'mi', 'km')
 * @param {string} to - The unit to convert to ('ft', 'm', 'mi', 'km')
 * @param {boolean} useDndConversion - Whether to use D&D simplified conversions
 * @returns {number} - The converted value
 */
export function convertDistance(value, from, to, useDndConversion = true) {
  if (value === 0 || from === to) return value;
  try {
    const ftPerMile = useDndConversion ? CONST.conversion.dndFtPerMile : CONST.conversion.ftPerMile;
    const ftPerKm = useDndConversion ? CONST.conversion.dndFtPerKm : CONST.conversion.ftPerKm;
    const mPerFt = CONST.conversion.mPerFt;
    let inFeet;
    switch (from) {
      case 'ft':
        inFeet = value;
        break;
      case 'm':
        inFeet = value / mPerFt;
        break;
      case 'mi':
        inFeet = value * ftPerMile;
        break;
      case 'km':
        inFeet = value * ftPerKm;
        break;
      default:
        console.warn(`TravelPace | Unknown unit for conversion: ${from}`);
        return value;
    }
    switch (to) {
      case 'ft':
        return inFeet;
      case 'm':
        return inFeet * mPerFt;
      case 'mi':
        return inFeet / ftPerMile;
      case 'km':
        return inFeet / ftPerKm;
      default:
        console.warn(`TravelPace | Unknown target unit for conversion: ${to}`);
        return inFeet;
    }
  } catch (error) {
    console.error('TravelPace | Error in convertDistance:', error);
    return value;
  }
}

/**
 * Calculate travel time based on distance and pace
 * @param {number} distance - Distance in feet
 * @param {string} pace - Travel pace ('fast', 'normal', 'slow')
 * @param {number|string} speedModifier - Modifier or direct speed (e.g. "8 mi/hour")
 * @param {boolean} useDndConversion - Whether to use D&D simplified conversions
 * @returns {Object} - Time breakdown in minutes, hours, and days
 */
export function calculateTime(distance, pace, speedModifier = 1, useDndConversion = true) {
  try {
    if (typeof speedModifier === 'string' && speedModifier.includes('/hour')) return calculateTimeWithVehicleSpeed(distance, pace, speedModifier);
    const milesPerDay = CONST.milesPerDay[pace];
    if (milesPerDay === undefined) {
      console.warn(`TravelPace | Invalid pace provided: ${pace}`);
      return breakdownMinutesToTimeUnits(0);
    }
    const ftPerMile = useDndConversion ? CONST.conversion.dndFtPerMile : CONST.conversion.ftPerMile;
    const feetPerDay = milesPerDay * ftPerMile;
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
    const speedMatch = speedNotation.match(/^(\d+(\.\d+)?)\s*(mi|km)\/hour$/);
    if (!speedMatch) return breakdownMinutesToTimeUnits(0);
    const baseSpeed = parseFloat(speedMatch[1]);
    const unit = speedMatch[3];
    const paceMultiplier = CONST.multipliers[pace] || 1;
    const adjustedSpeed = baseSpeed * paceMultiplier;
    const distanceInUnit = convertDistance(distance, 'ft', unit, false);
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
    if (typeof speedModifier === 'string' && speedModifier.includes('/hour')) return calculateDistanceWithVehicleSpeed(minutes, pace, speedModifier);
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
    const speedMatch = speedNotation.match(/^(\d+(\.\d+)?)\s*(mi|km)\/hour$/);
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
    if (unit === 'mi') {
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
  if (!timeData) return '0 minutes';
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
    if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`);
    if (remainingMonths > 0) parts.push(`${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`);
    if (remainingWeeks > 0) parts.push(`${remainingWeeks} week${remainingWeeks > 1 ? 's' : ''}`);
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
    return parts.length > 0 ? parts.join(', ') : '0 minutes';
  } catch (error) {
    console.error('TravelPace | Error in formatTime:', error);
    return '0 minutes';
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
      if (movement.units === 'mi' || movement.units === 'km') {
        const speeds = Object.entries(movement)
          .filter(([key, value]) => typeof value === 'number' && key !== 'units')
          .map(([key, value]) => value);
        if (speeds.length === 0) return 1;
        const speedValue = Math.max(...speeds);
        return `${speedValue} ${movement.units}/hour`;
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
  try {
    Handlebars.registerHelper('travelpace-concat', (a, b) => a + b);
    Handlebars.registerHelper('travelpace-capitalize', (str) => str.charAt(0).toUpperCase() + str.slice(1));
    Handlebars.registerHelper('travelpace-multiply', (a, b) => a * b);
  } catch (error) {
    console.error('TravelPace | Error registering Handlebars helpers:', error);
  }
});
