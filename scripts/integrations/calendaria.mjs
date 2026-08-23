import { MODULE, SETTINGS, SEVERITY_DEFAULTS } from '../constants.mjs';

/**
 * Whether Calendaria is installed and active, guarding access to its global namespace.
 * @returns {boolean} True when the CALENDARIA global is safe to read
 */
export function isCalendariaActive() {
  return !!game.modules.get('calendaria')?.active;
}

/**
 * Calendaria's named weather severity bands, ascending.
 * @returns {Array<{id: string, label: string}>} Band descriptors, empty without Calendaria
 */
export function getSeverityLevels() {
  if (!isCalendariaActive()) return [];
  return CALENDARIA.api.getWeatherSeverityLevels().map((level) => ({ id: level.id, label: _loc(level.label) }));
}

/**
 * Build the pace modifiers the current weather implies, from the GM's preset and severity tables.
 * @returns {Array<{id: string, label: string, multiplier: number}>} Labeled multipliers, empty when weather is off or unavailable
 */
export function getWeatherModifiers() {
  if (!game.settings.get(MODULE.ID, SETTINGS.USE_WEATHER) || !isCalendariaActive()) return [];
  const weather = CALENDARIA.api.getCurrentWeather();
  if (!weather) return [];
  const level = CALENDARIA.api.getWeatherSeverityLevel(weather.severity);
  const presetMultiplier = Number(game.settings.get(MODULE.ID, SETTINGS.WEATHER_MULTIPLIERS)[weather.id]) || 1;
  const severityMultiplier = Number(game.settings.get(MODULE.ID, SETTINGS.SEVERITY_MULTIPLIERS)[level?.id] ?? SEVERITY_DEFAULTS[level?.id]) || 1;
  const modifiers = [];
  if (presetMultiplier !== 1) modifiers.push({ id: `weather.${weather.id}`, label: weather.label || weather.id, multiplier: presetMultiplier });
  if (severityMultiplier !== 1) modifiers.push({ id: 'weather.severity', label: level.label, multiplier: severityMultiplier });
  return modifiers;
}
