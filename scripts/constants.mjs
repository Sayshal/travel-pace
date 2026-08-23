/** @type {object} Module and application identifiers. */
export const MODULE = { ID: 'travel-pace', APP_ID: 'travel-pace-calculator' };

/** @enum {string} World-setting keys. */
export const SETTINGS = {
  SHOW_EFFECTS: 'showEffects',
  ENABLED_MOUNTS: 'enabledMounts',
  ADVANCE_MODE: 'advanceMode',
  USE_WEATHER: 'useWeather',
  WEATHER_MULTIPLIERS: 'weatherMultipliers',
  SEVERITY_MULTIPLIERS: 'severityMultipliers'
};

/** @enum {string} Handlebars template paths. */
export const TEMPLATES = {
  MODE_TOGGLE: 'modules/travel-pace/templates/mode-toggle.hbs',
  JOURNEY: 'modules/travel-pace/templates/journey.hbs',
  TRAVELLER: 'modules/travel-pace/templates/traveller.hbs',
  RESULT: 'modules/travel-pace/templates/result.hbs',
  FORM_FOOTER: 'templates/generic/form-footer.hbs',
  CHAT_MESSAGE: 'modules/travel-pace/templates/chat-message.hbs',
  MOUNT_CONFIG: 'modules/travel-pace/templates/mount-config.hbs',
  WEATHER_CONFIG: 'modules/travel-pace/templates/weather-config.hbs'
};

/** @type {object} Quantities the travel table assumes that the system does not define. */
export const TRAVEL = { WALK_BASELINE_FEET: 30 };

/** @enum {number} Pace multipliers per Calendaria weather severity band, used until the GM sets their own. */
export const SEVERITY_DEFAULTS = { none: 1, light: 0.95, moderate: 0.85, heavy: 0.7, severe: 0.5, extreme: 0.3 };
