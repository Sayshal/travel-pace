/**
 * Configuration constants for the Travel Pace Calculator
 */
export const CONST = {
  /**
   * Pace multipliers relative to normal pace
   */
  multipliers: {
    fast: 1.33,
    normal: 1.0,
    slow: 0.67
  },

  /**
   * Standard D&D 5e travel distances in miles per day (8 hours)
   */
  milesPerDay: {
    fast: 30,
    normal: 24,
    slow: 18
  },

  /**
   * Standard speeds in feet per minute
   */
  speedsInFeet: {
    fast: 400,
    normal: 300,
    slow: 200
  },

  /**
   * Unit conversion factors
   */
  conversion: {
    // Standard conversions
    ftPerMile: 5280,
    ftPerKm: 3280.84,
    mPerFt: 0.3048,
    miToKm: 1.60934,
    kmToMi: 0.621371,

    // D&D simplified conversions (optional)
    dndFtPerMile: 6000,
    dndFtPerKm: 3000
  },

  /**
   * Travel day parameters
   */
  timeUnits: {
    hoursPerDay: 8,
    minutesPerHour: 60,
    minutesPerDay: 480 // 8 hours * 60 minutes
  },

  /**
   * Module settings keys
   */
  settings: {
    useMetric: 'useMetric',
    showEffects: 'showEffects',
    enabledMounts: 'enabledMounts'
  },

  /**
   * Module identifiers
   */
  moduleId: 'travel-pace'
};
