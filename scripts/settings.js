const SETTINGS = {
  forcedMarch: {
    type: Boolean,
    default: true,
    scope: 'world',
    config: true,
    name: 'TravelPace.settings.forcedMarch.name',
    hint: 'TravelPace.settings.forcedMarch.hint'
  },
  useMetric: {
    type: Boolean,
    default: false,
    scope: 'world',
    config: true,
    name: 'TravelPace.settings.useMetric.name',
    hint: 'TravelPace.settings.useMetric.hint'
  },
  preview: {
    type: Object,
    default: {},
    scope: 'world',
    config: false
  }
};

Hooks.once('init', () => {
  // Register all settings
  for (const [key, data] of Object.entries(SETTINGS)) {
    game.settings.register('travel-pace', key, data);
  }
});
