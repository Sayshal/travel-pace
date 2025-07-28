/**
 * Configuration constants for the Travel Pace Calculator module
 * @module travel-pace/config
 */
export const CONST = {
  multipliers: { fast: 1.33, normal: 1.0, slow: 0.67 },
  milesPerDay: { fast: 30, normal: 24, slow: 18 },
  speedsInFeet: { fast: 400, normal: 300, slow: 200 },
  conversion: { ftPerMile: 5280, ftPerKm: 3280.84, mPerFt: 0.3048, miToKm: 1.60934, kmToMi: 0.621371, dndFtPerMile: 6000, dndFtPerKm: 3000 },
  timeUnits: { hoursPerDay: 8, minutesPerHour: 60, minutesPerDay: 480 },
  settings: { useMetric: 'useMetric', showEffects: 'showEffects', enabledMounts: 'enabledMounts' },
  moduleId: 'travel-pace'
};
