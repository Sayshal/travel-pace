import { registerSettings } from './scripts/settings.mjs';
import { TravelCalculator } from './scripts/travel-calculator.mjs';

Hooks.once('init', () => {
  ATLAS.register('travel-pace', {
    title: 'Travel Pace',
    github: 'Sayshal/travel-pace',
    theme: { scope: '.travel-calculator-window, .travel-pace-app' }
  });
  registerSettings();
  const api = {
    /** @returns {string} The distance unit abbreviation the world is configured for */
    get unit() {
      return TravelCalculator.unit;
    },
    calculateTravel: (data) => TravelCalculator.calculateTravel(data),
    submitCalculation: (data) => TravelCalculator.submitCalculation(data),
    createChatMessage: (result) => TravelCalculator.createChatMessage(result),
    durationToSeconds: (totalMinutes) => TravelCalculator.durationToSeconds(totalMinutes),
    openCalculator: () => TravelCalculator.openCalculator()
  };
  game.modules.get('travel-pace').api = api;
  globalThis.TRAVELPACE = api;
  ATLAS.log(3, 'Initializing module');
});
Hooks.on('getSceneControlButtons', (controls) => TravelCalculator.getSceneControlButtons(controls));
Hooks.on('renderChatMessageHTML', (message, html) => TravelCalculator.onRenderChatMessage(message, html));
