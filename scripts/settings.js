Hooks.once('init', () => {
  game.settings.register('travel-pace', 'ForcedMarchDialog', {
    name: game.i18n.localize('TravelPace.Settings.ForcedMarchDialog'),
    hint: game.i18n.localize('TravelPace.Settings.ForcedMarchDialogHint'),
    scope: 'world',
    config: true,
    default: true,
    type: Boolean
  });
  game.settings.register('travel-pace', 'MetricSystem', {
    name: game.i18n.localize('TravelPace.Settings.MetricSystem'),
    hint: game.i18n.localize('TravelPace.Settings.MetricSystemHint'),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean
  });
  game.settings.register('travel-pace', 'previewSetting', {
    name: game.i18n.localize('TravelPace.Settings.previewSetting'),
    hint: game.i18n.localize('TravelPace.Settings.previewSettingHint'),
    default: {},
    type: Object,
    scope: 'world',
    config: false
  });
});
