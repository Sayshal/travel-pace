/**
 * Convert between different distance units
 * @param {number} value - The value to convert
 * @param {string} from - The unit to convert from ('ft', 'm', 'mi', 'km')
 * @param {string} to - The unit to convert to ('ft', 'm', 'mi', 'km')
 * @param {boolean} useDndConversion - Whether to use D&D simplified conversions (default: true)
 * @returns {number} - The converted value
 */
export function convertDistance(value, from, to, useDndConversion = true) {
  // Conversion factors
  let ftPerMile = useDndConversion ? 6000 : 5280;
  let ftPerKm = useDndConversion ? 3000 : 3280.84;
  let mPerFt = 0.3048; // Standard meters per foot

  // First convert to feet as the base unit
  let inFeet = value;

  switch (from) {
    case 'm':
      inFeet = value / mPerFt;
      break;
    case 'mi':
      inFeet = value * ftPerMile;
      break;
    case 'km':
      inFeet = value * ftPerKm;
      break;
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
  }

  return inFeet; // Default to feet if unit not recognized
}

/**
 * Get the travel speeds for different paces in feet per minute
 * @returns {Object} - Speeds for different paces
 */
export function getTravelSpeeds() {
  return {
    normal: 300, // 300 feet per minute
    fast: 400, // 400 feet per minute
    slow: 200 // 200 feet per minute
  };
}

/**
 * Calculate travel time based on distance and pace
 * @param {number} distance - Distance in feet
 * @param {string} pace - Travel pace ('fast', 'normal', 'slow')
 * @param {number|string} speedModifier - Modifier or direct speed (e.g. "8 mi/hour")
 * @returns {Object} - Time breakdown in minutes, hours, and days
 */
export function calculateTime(distance, pace, speedModifier = 1) {
  console.log(`Calculating time with:
    - Distance: ${distance} feet
    - Pace: ${pace}
    - Speed modifier: ${speedModifier}`);

  // Pace modifiers - these are the standard D&D ratios
  const paceMultipliers = {
    fast: 1.33,
    normal: 1.0,
    slow: 0.67
  };

  // Check if speedModifier is a string with direct speed notation
  if (typeof speedModifier === 'string' && speedModifier.includes('/hour')) {
    // Direct vehicle speed calculation (e.g., "8 mi/hour")
    const speedMatch = speedModifier.match(/^(\d+(\.\d+)?)\s*(mi|km)\/hour$/);

    if (speedMatch) {
      const baseSpeed = parseFloat(speedMatch[1]);
      const unit = speedMatch[3];

      // Apply pace multiplier to the vehicle's speed
      const adjustedSpeed = baseSpeed * paceMultipliers[pace];

      // We need to convert between our distance (in feet) and our speed unit (mi/hour or km/hour)
      let totalHours;

      if (unit === 'mi') {
        // Standard conversion: 5280 feet per mile
        const distanceInMiles = distance / 5280;
        totalHours = distanceInMiles / adjustedSpeed;
      } else if (unit === 'km') {
        // Standard conversion: 3280.84 feet per kilometer
        const distanceInKm = distance / 3280.84;
        totalHours = distanceInKm / adjustedSpeed;
      }

      const totalMinutes = totalHours * 60;

      const days = Math.floor(totalHours / 8); // Assuming 8-hour travel days
      const remainingHours = totalHours % 8;
      const hours = Math.floor(remainingHours);
      const minutes = Math.round((remainingHours - hours) * 60);

      console.log(`Direct speed calculation result with pace ${pace} (${paceMultipliers[pace]}x):
        - Base speed: ${baseSpeed} ${unit}/hour
        - Adjusted speed: ${adjustedSpeed} ${unit}/hour
        - Total hours: ${totalHours}
        - Total minutes: ${totalMinutes}
        - Days: ${days}
        - Hours: ${hours}
        - Minutes: ${minutes}`);

      return {
        totalMinutes,
        minutes,
        hours,
        days
      };
    }
  }

  // These are the D&D standard distances for 8 hours of travel
  const milesPerDay = {
    fast: 30,
    normal: 24,
    slow: 18
  };

  // For each pace, this is the feet that should equal exactly 8 hours
  // Using the D&D simplified 6000ft/mile for on-foot travel
  const feetPerDay = {
    fast: milesPerDay.fast * 6000,
    normal: milesPerDay.normal * 6000,
    slow: milesPerDay.slow * 6000
  };

  // Calculate what percentage of a day this travel represents
  const dayFraction = (distance / feetPerDay[pace]) * (1 / speedModifier);
  const totalMinutes = dayFraction * 8 * 60; // 8 hours = 480 minutes

  // Break down into days, hours, minutes
  const totalDays = Math.floor(totalMinutes / 480); // 480 minutes = 8 hours = 1 travel day
  const remainingMinutes = totalMinutes % 480;
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = Math.floor(remainingMinutes % 60);

  console.log(`Standard time calculation result:
    - Total minutes: ${totalMinutes}
    - Days: ${totalDays}
    - Hours: ${hours}
    - Minutes: ${minutes}`);

  return {
    totalMinutes,
    minutes,
    hours,
    days: totalDays
  };
}

/**
 * Calculate travel distance based on time and pace
 * @param {number} minutes - Time in minutes
 * @param {string} pace - Travel pace ('fast', 'normal', 'slow')
 * @param {number|string} speedModifier - Modifier or direct speed (e.g. "8 mi/hour")
 * @returns {Object} - Distance in different units
 */
export function calculateDistance(minutes, pace, speedModifier = 1) {
  // Pace modifiers - these are the standard D&D ratios
  const paceMultipliers = {
    fast: 1.33,
    normal: 1.0,
    slow: 0.67
  };

  // Check if speedModifier is a string with direct speed notation
  if (typeof speedModifier === 'string' && speedModifier.includes('/hour')) {
    // Direct vehicle speed calculation (e.g., "8 mi/hour")
    const speedMatch = speedModifier.match(/^(\d+(\.\d+)?)\s*(mi|km)\/hour$/);

    if (speedMatch) {
      const baseSpeed = parseFloat(speedMatch[1]);
      const unit = speedMatch[3];

      // Apply pace multiplier
      const adjustedSpeed = baseSpeed * paceMultipliers[pace];

      // Convert minutes to hours
      const hours = minutes / 60;

      // Simple calculation: distance = speed * time
      const directDistance = adjustedSpeed * hours;

      console.log(`Direct distance calculation with pace ${pace} (${paceMultipliers[pace]}x):
        - Base speed: ${baseSpeed} ${unit}/hour
        - Adjusted speed: ${adjustedSpeed} ${unit}/hour
        - Hours: ${hours}
        - Distance: ${directDistance} ${unit}`);

      // Create a complete return object with standard conversions
      let result = {};

      if (unit === 'mi') {
        result = {
          miles: directDistance,
          feet: directDistance * 5280, // Standard feet per mile
          meters: directDistance * 1609.34, // Standard meters per mile
          kilometers: directDistance * 1.60934 // Standard km per mile
        };
      } else if (unit === 'km') {
        result = {
          kilometers: directDistance,
          meters: directDistance * 1000, // Standard meters per km
          feet: directDistance * 3280.84, // Standard feet per km (proper conversion)
          miles: directDistance * 0.621371 // Standard miles per km
        };
      }

      return result;
    }
  }

  // D&D Standard: 8 hours (480 minutes) of travel results in:
  const milesPerDay = {
    fast: 30,
    normal: 24,
    slow: 18
  };

  // Calculate what fraction of a day this represents
  const dayFraction = minutes / 480; // 480 minutes = 8 hours

  // Calculate miles based on that fraction
  const miles = milesPerDay[pace] * dayFraction * speedModifier;

  // Convert to feet using D&D's 6000ft/mile for on-foot travel
  const feet = miles * 6000;

  return {
    feet,
    miles,
    meters: convertDistance(feet, 'ft', 'm'),
    kilometers: convertDistance(feet, 'ft', 'km')
  };
}

/**
 * Format time for display
 * @param {Object} timeData - Time data from calculateTime
 * @returns {string} - Formatted time string
 */
export function formatTime(timeData) {
  // Get original values
  let minutes = timeData.minutes;
  let hours = timeData.hours;
  let days = timeData.days;

  // Round minutes and cascade if necessary
  if (minutes >= 59.5) {
    minutes = 0;
    hours += 1;
  } else {
    minutes = Math.round(minutes);
  }

  // Cascade hours to days if necessary
  if (hours >= 23.5) {
    hours = 0;
    days += 1;
  } else if (hours > 8) {
    // For hours not quite at a full day but close enough to round
    // This is a design choice - you may want to adjust this threshold
    const extraDays = Math.floor(hours / 8);
    if (hours % 8 >= 7.5) {
      days += extraDays + 1;
      hours = 0;
    } else {
      days += extraDays;
      hours = hours % 8;
    }
  }

  // Calculate weeks, months, years, decades
  const decades = Math.floor(days / 3650); // 365 days * 10 years
  days = days % 3650;

  const years = Math.floor(days / 365);
  days = days % 365;

  const months = Math.floor(days / 30);
  days = days % 30;

  const weeks = Math.floor(days / 7);
  days = days % 7;

  const parts = [];

  // Add decades if any
  if (decades > 0) {
    parts.push(`${decades} decade${decades > 1 ? 's' : ''}`);
  }

  // Add years if any
  if (years > 0) {
    parts.push(`${years} year${years > 1 ? 's' : ''}`);
  }

  // Add months if any
  if (months > 0) {
    parts.push(`${months} month${months > 1 ? 's' : ''}`);
  }

  // Add weeks if any
  if (weeks > 0) {
    parts.push(`${weeks} week${weeks > 1 ? 's' : ''}`);
  }

  // Add days if any
  if (days > 0) {
    parts.push(`${days} day${days > 1 ? 's' : ''}`);
  }

  // Add hours based on conditions
  if (hours > 0) {
    parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  }

  // Add minutes based on specific rules
  // 1. Show minutes if it's the only unit (no days, no hours)
  // 2. Show minutes if there are hours but no days
  // 3. Show minutes if there are days AND hours > 0 AND minutes > 15
  const originalDays = timeData.days;
  const originalHours = timeData.hours;
  const showMinutes =
    parts.length === 0 || // No parts yet
    (originalDays === 0 && originalHours === 0) || // Only minutes
    (originalDays === 0 && hours > 0) || // Hours and minutes, no days
    (originalDays > 0 && hours > 0 && minutes > 15); // Days, hours > 0, and minutes > 15

  if (minutes > 0 && showMinutes) {
    parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
  }

  // If no parts, return "0 minutes"
  if (parts.length === 0) {
    return '0 minutes';
  }

  return parts.join(', ');
}

/**
 * Get the movement speed for a mount or vehicle
 * @param {string} actorId - The ID of the actor
 * @returns {number|string} - Speed modifier or direct speed value
 */
export function getMountSpeedModifier(actorId) {
  if (!actorId) return 1;

  // Try to get actor from world or compendium
  let actor;
  if (actorId.includes('.')) {
    // It's a compendium actor, use fromUuid asynchronously
    fromUuid(actorId).then((result) => {
      actor = result;
    });
    if (!actor) return 1;
  } else {
    actor = game.actors.get(actorId);
    if (!actor) return 1;
  }

  // Default walking speed is 30ft per round = 300ft per minute
  const baseSpeed = 30;

  if (actor.type === 'vehicle') {
    // Handle vehicle speed
    const movement = actor.system.attributes?.movement || {};
    if (movement.units === 'mi' || movement.units === 'km') {
      // Get the highest speed
      const speedValue = Math.max(
        ...Object.entries(movement)
          .filter(([key, value]) => typeof value === 'number' && key !== 'units')
          .map(([key, value]) => value)
      );

      // Return as a direct speed string
      return `${speedValue} ${movement.units}/hour`;
    }
  }

  // For NPCs, use their walk speed
  const walkSpeed = actor.system.attributes?.movement?.walk || baseSpeed;
  return walkSpeed / baseSpeed;
}

/**
 * Get the pace effects for display
 * @param {string} pace - The travel pace ('fast', 'normal', 'slow')
 * @returns {string} - Description of the pace effects
 */
export function getPaceEffects(pace) {
  switch (pace) {
    case 'fast':
      return game.i18n.localize('TravelPace.Effects.Fast');
    case 'normal':
      return game.i18n.localize('TravelPace.Effects.Normal');
    case 'slow':
      return game.i18n.localize('TravelPace.Effects.Slow');
    default:
      return '';
  }
}

// Add to the init hook in settings.js
Hooks.once('init', () => {
  Handlebars.registerHelper('neq', function (a, b) {
    return a !== b;
  });

  Handlebars.registerHelper('concat', function (a, b) {
    return a + b;
  });

  Handlebars.registerHelper('capitalize', function (str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  Handlebars.registerHelper('multiply', function (a, b) {
    return a * b;
  });
});
