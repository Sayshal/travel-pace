import { MODULE, SETTINGS, SEVERITY_DEFAULTS, TEMPLATES } from '../constants.mjs';
import { getSeverityLevels, isCalendariaActive } from '../integrations/calendaria.mjs';
import { FOOTER_PART, TravelPaceMenu } from './menu.mjs';

/** Configuration menu for weather-preset and weather-severity pace multipliers. */
export class WeatherConfigMenu extends TravelPaceMenu {
  static PARTS = { form: { template: TEMPLATES.WEATHER_CONFIG }, footer: FOOTER_PART };
  static DEFAULT_OPTIONS = {
    id: 'travel-pace-weather-config',
    window: { icon: 'fa-solid fa-cloud-sun-rain', title: 'TRAVELPACE.Settings.WeatherConfig.Title' },
    form: { handler: WeatherConfigMenu.#onSubmit, closeOnSubmit: true }
  };

  /** @inheritdoc */
  async _prepareContext(_options) {
    const presetMultipliers = game.settings.get(MODULE.ID, SETTINGS.WEATHER_MULTIPLIERS);
    const severityMultipliers = game.settings.get(MODULE.ID, SETTINGS.SEVERITY_MULTIPLIERS);
    const presets = isCalendariaActive() ? await CALENDARIA.api.getWeatherPresets() : [];

    return {
      presets: presets.map((preset) => ({
        id: preset.id,
        label: _loc(preset.label || preset.id),
        icon: preset.icon.includes(' ') ? preset.icon : `fas ${preset.icon}`,
        color: preset.color || 'inherit',
        multiplier: presetMultipliers[preset.id] ?? 1
      })),
      severities: getSeverityLevels().map((level) => ({ ...level, multiplier: severityMultipliers[level.id] ?? SEVERITY_DEFAULTS[level.id] ?? 1 })),
      buttons: [{ type: 'submit', icon: 'fas fa-save', label: 'TRAVELPACE.Buttons.Save' }]
    };
  }

  /**
   * Persist the multiplier tables, dropping any preset left at 1.
   * @this {WeatherConfigMenu}
   * @param {SubmitEvent} _event Form submit event
   * @param {HTMLFormElement} _form Submitted form element
   * @param {foundry.applications.ux.FormDataExtended} formData Parsed form data
   * @returns {Promise<void>}
   */
  static async #onSubmit(_event, _form, formData) {
    const { preset = {}, severity = {} } = foundry.utils.expandObject(formData.object);
    if (!Object.keys(preset).length && !Object.keys(severity).length) return;
    const presetMultipliers = {};
    const severityMultipliers = {};
    for (const [id, value] of Object.entries(preset)) if (Number(value) > 0 && Number(value) !== 1) presetMultipliers[id] = Number(value);
    for (const [id, value] of Object.entries(severity)) if (Number(value) > 0) severityMultipliers[id] = Number(value);
    await game.settings.set(MODULE.ID, SETTINGS.WEATHER_MULTIPLIERS, presetMultipliers);
    await game.settings.set(MODULE.ID, SETTINGS.SEVERITY_MULTIPLIERS, severityMultipliers);
    ui.notifications.info('TRAVELPACE.Settings.WeatherConfig.Saved');
  }
}
