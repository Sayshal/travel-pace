import { registerSettings } from './scripts/settings.mjs';
import { TravelCalculator } from './scripts/travel-calculator.mjs';

Hooks.once('init', () => {
  ATLAS.register('travel-pace', {
    title: 'Travel Pace',
    github: 'Sayshal/travel-pace',
    theme: { scope: '.travel-calculator-window, .travel-pace-app' }
  });
  registerSettings();
  ATLAS.log(3, 'Initializing module');
});
Hooks.on('getSceneControlButtons', (controls) => TravelCalculator.getSceneControlButtons(controls));
