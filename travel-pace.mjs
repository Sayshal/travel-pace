import { registerSettings } from './scripts/settings.mjs';
import { TravelCalculator } from './scripts/travel-calculator.mjs';

Hooks.once('init', registerSettings);
Hooks.on('getSceneControlButtons', (controls) => TravelCalculator.getSceneControlButtons(controls));
