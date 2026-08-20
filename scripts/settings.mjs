import { MountConfigMenu } from './apps/mount-config.mjs';
import { WeatherConfigMenu } from './apps/weather-config.mjs';
import { MODULE, SETTINGS } from './constants.mjs';

/** Register the module's settings and its two configuration menus. Call once during the init hook. */
export function registerSettings() {
  game.settings.register(MODULE.ID, SETTINGS.SHOW_EFFECTS, {
    name: 'TRAVELPACE.Settings.ShowEffects.Name',
    hint: 'TRAVELPACE.Settings.ShowEffects.Hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(MODULE.ID, SETTINGS.ADVANCE_MODE, {
    name: 'TRAVELPACE.Settings.AdvanceMode.Name',
    hint: 'TRAVELPACE.Settings.AdvanceMode.Hint',
    scope: 'world',
    config: true,
    type: String,
    choices: { calendar: 'TRAVELPACE.Settings.AdvanceMode.Calendar', travel: 'TRAVELPACE.Settings.AdvanceMode.Travel' },
    default: 'calendar'
  });
  game.settings.register(MODULE.ID, SETTINGS.USE_WEATHER, {
    name: 'TRAVELPACE.Settings.UseWeather.Name',
    hint: 'TRAVELPACE.Settings.UseWeather.Hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });
  game.settings.register(MODULE.ID, SETTINGS.WEATHER_MULTIPLIERS, { scope: 'world', config: false, type: Object, default: {} });
  game.settings.register(MODULE.ID, SETTINGS.SEVERITY_MULTIPLIERS, { scope: 'world', config: false, type: Object, default: {} });
  game.settings.register(MODULE.ID, SETTINGS.ENABLED_MOUNTS, { scope: 'world', config: false, type: Array, default: [] });
  game.settings.registerMenu(MODULE.ID, 'mountConfigMenu', {
    name: 'TRAVELPACE.Settings.MountConfig.Name',
    label: 'ATLAS.Common.Configure',
    hint: 'TRAVELPACE.Settings.MountConfig.Hint',
    icon: 'fas fa-horse',
    type: MountConfigMenu,
    restricted: true
  });
  game.settings.registerMenu(MODULE.ID, 'weatherConfigMenu', {
    name: 'TRAVELPACE.Settings.WeatherConfig.Name',
    label: 'ATLAS.Common.Configure',
    hint: 'TRAVELPACE.Settings.WeatherConfig.Hint',
    icon: 'fas fa-cloud-sun-rain',
    type: WeatherConfigMenu,
    restricted: true
  });
}
