import { CONST } from './config.js';

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

  // Select conversion factors based on whether to use D&D simplified values
  const ftPerMile = useDndConversion ? CONST.conversion.dndFtPerMile : CONST.conversion.ftPerMile;
  const ftPerKm = useDndConversion ? CONST.conversion.dndFtPerKm : CONST.conversion.ftPerKm;
  const mPerFt = CONST.conversion.mPerFt;

  // First convert to feet as the base unit
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
      return value;
  }

  // Then convert from feet to the target unit
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
      return inFeet;
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
  // Handle direct vehicle speed notation (e.g., "8 mi/hour")
  if (typeof speedModifier === 'string' && speedModifier.includes('/hour')) {
    return calculateTimeWithVehicleSpeed(distance, pace, speedModifier);
  }

  // Standard calculation based on pace and modifier
  const milesPerDay = CONST.milesPerDay[pace];

  // Select the appropriate conversion factor based on whether to use DnD conversions
  const ftPerMile = useDndConversion ? CONST.conversion.dndFtPerMile : CONST.conversion.ftPerMile;
  const feetPerDay = milesPerDay * ftPerMile;

  // Calculate what percentage of a day this travel represents
  const dayFraction = (distance / feetPerDay) * (1 / speedModifier);
  const totalMinutes = dayFraction * CONST.timeUnits.minutesPerDay;

  return breakdownMinutesToTimeUnits(totalMinutes);
}

/**
 * Calculate time using vehicle speed notation
 * @param {number} distance - Distance in feet
 * @param {string} pace - Travel pace ('fast', 'normal', 'slow')
 * @param {string} speedNotation - Speed in format "X mi/hour" or "X km/hour"
 * @returns {Object} - Time breakdown
 */
function calculateTimeWithVehicleSpeed(distance, pace, speedNotation) {
  const speedMatch = speedNotation.match(/^(\d+(\.\d+)?)\s*(mi|km)\/hour$/);
  if (!speedMatch) return breakdownMinutesToTimeUnits(0);

  const baseSpeed = parseFloat(speedMatch[1]);
  const unit = speedMatch[3];
  const paceMultiplier = CONST.multipliers[pace];
  const adjustedSpeed = baseSpeed * paceMultiplier;

  // Convert distance from feet to the appropriate unit using STANDARD conversions
  // Always use standard conversions for vehicles with direct speed
  const distanceInUnit = convertDistance(distance, 'ft', unit, false);

  // Calculate time in hours
  const totalHours = distanceInUnit / adjustedSpeed;
  const totalMinutes = totalHours * CONST.timeUnits.minutesPerHour;

  return breakdownMinutesToTimeUnits(totalMinutes);
}

/**
 * Break down minutes into days, hours, and minutes
 * @param {number} totalMinutes - Total minutes
 * @returns {Object} - Time breakdown
 */
function breakdownMinutesToTimeUnits(totalMinutes) {
  const days = Math.floor(totalMinutes / CONST.timeUnits.minutesPerDay);
  const remainingMinutes = totalMinutes % CONST.timeUnits.minutesPerDay;
  const hours = Math.floor(remainingMinutes / CONST.timeUnits.minutesPerHour);
  const minutes = Math.floor(remainingMinutes % CONST.timeUnits.minutesPerHour);

  return {
    totalMinutes,
    minutes,
    hours,
    days
  };
}

/**
 * Calculate travel distance based on time and pace
 * @param {number} minutes - Time in minutes
 * @param {string} pace - Travel pace ('fast', 'normal', 'slow')
 * @param {number|string} speedModifier - Modifier or direct speed
 * @returns {Object} - Distance in different units
 */
export function calculateDistance(minutes, pace, speedModifier = 1) {
  // Handle direct vehicle speed notation
  if (typeof speedModifier === 'string' && speedModifier.includes('/hour')) {
    return calculateDistanceWithVehicleSpeed(minutes, pace, speedModifier);
  }

  // Convert minutes to days
  const dayFraction = minutes / CONST.timeUnits.minutesPerDay;

  // Calculate miles based on pace and time
  const miles = CONST.milesPerDay[pace] * dayFraction * speedModifier;

  // Create result with all unit conversions
  return {
    miles,
    feet: miles * CONST.conversion.ftPerMile,
    kilometers: miles * CONST.conversion.miToKm,
    meters: miles * CONST.conversion.ftPerMile * CONST.conversion.mPerFt
  };
}

/**
 * Calculate distance using vehicle speed notation
 * @param {number} minutes - Time in minutes
 * @param {string} pace - Travel pace ('fast', 'normal', 'slow')
 * @param {string} speedNotation - Speed in format "X mi/hour" or "X km/hour"
 * @returns {Object} - Distance in different units
 */
function calculateDistanceWithVehicleSpeed(minutes, pace, speedNotation) {
  const speedMatch = speedNotation.match(/^(\d+(\.\d+)?)\s*(mi|km)\/hour$/);
  if (!speedMatch) return { miles: 0, feet: 0, kilometers: 0, meters: 0 };

  const baseSpeed = parseFloat(speedMatch[1]);
  const unit = speedMatch[3];
  const paceMultiplier = CONST.multipliers[pace];
  const adjustedSpeed = baseSpeed * paceMultiplier;

  // Convert minutes to hours
  const hours = minutes / CONST.timeUnits.minutesPerHour;

  // Calculate direct distance in the unit specified
  const directDistance = adjustedSpeed * hours;

  // Create a complete return object with all units
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
}

/**
 * Format time for display
 * @param {Object} timeData - Time data from calculateTime
 * @returns {string} - Formatted time string
 */
export function formatTime(timeData) {
  if (!timeData) return '0 minutes';

  // Extract time components
  let { minutes, hours, days } = timeData;

  // Round minutes and handle overflow
  if (minutes >= 59.5) {
    minutes = 0;
    hours += 1;
  } else {
    minutes = Math.round(minutes);
  }

  // Handle hour overflow
  if (hours >= 8) {
    const additionalDays = Math.floor(hours / 8);
    days += additionalDays;
    hours %= 8;
  }

  // Handle larger time units
  const weeks = Math.floor(days / 7);
  days %= 7;

  const months = Math.floor(weeks / 4);
  const remainingWeeks = weeks % 4;

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  // Build the output string
  const parts = [];

  if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`);
  if (remainingMonths > 0) parts.push(`${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`);
  if (remainingWeeks > 0) parts.push(`${remainingWeeks} week${remainingWeeks > 1 ? 's' : ''}`);
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);

  return parts.length > 0 ? parts.join(', ') : '0 minutes';
}

/**
 * Get the movement speed for a mount or vehicle
 * @param {string} actorId - The ID of the actor
 * @returns {number|string} - Speed modifier or direct speed value
 */
export function getMountSpeedModifier(actorId) {
  if (!actorId) return 1;

  // Try to get actor from world
  const actor = game.actors.get(actorId);
  if (!actor) {
    // If not found, it might be a compendium actor
    if (actorId.includes('.')) {
      // Return 1 as default, and let the async method handle it later
      return 1;
    }
    return 1;
  }

  // Default walking speed is 30ft per round
  const baseSpeed = 30;

  if (actor.type === 'vehicle') {
    // Handle vehicle speed
    const movement = actor.system.attributes?.movement || {};
    if (movement.units === 'mi' || movement.units === 'km') {
      // Get the highest speed
      const speeds = Object.entries(movement)
        .filter(([key, value]) => typeof value === 'number' && key !== 'units')
        .map(([key, value]) => value);

      if (speeds.length === 0) return 1;

      // Return as a direct speed string
      const speedValue = Math.max(...speeds);
      return `${speedValue} ${movement.units}/hour`;
    }
  }

  // For NPCs, use their walk speed as a multiplier
  const walkSpeed = actor.system.attributes?.movement?.walk || baseSpeed;
  return walkSpeed / baseSpeed;
}

/**
 * Get the pace effects for display
 * @param {string} pace - The travel pace ('fast', 'normal', 'slow')
 * @returns {string} - Description of the pace effects
 */
export function getPaceEffects(pace) {
  const key = `TravelPace.Effects.${pace.charAt(0).toUpperCase() + pace.slice(1)}`;
  return game.i18n.localize(key);
}

// Register Handlebars helpers
Hooks.once('init', () => {
  Handlebars.registerHelper('neq', (a, b) => a !== b);
  Handlebars.registerHelper('concat', (a, b) => a + b);
  Handlebars.registerHelper('capitalize', (str) => str.charAt(0).toUpperCase() + str.slice(1));
  Handlebars.registerHelper('multiply', (a, b) => a * b);
});
