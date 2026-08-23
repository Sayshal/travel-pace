import { TravelPaceApp } from './apps/calculator.mjs';
import { TravelCalculator } from './travel-calculator.mjs';

/**
 * Add the travel-pace button to the token scene controls.
 * @param {object} controls The scene-controls record
 * @returns {void}
 */
function onGetSceneControlButtons(controls) {
  if (!controls.tokens?.tools) return;
  controls.tokens.tools['travel-pace'] = { name: 'travel-pace', title: _loc('TRAVELPACE.Button'), icon: 'fas fa-route', visible: true, button: true, onChange: () => TravelPaceApp.show() };
}

/**
 * Wire the module's global hooks.
 * @returns {void}
 */
export function registerHooks() {
  Hooks.on('getSceneControlButtons', onGetSceneControlButtons);
  Hooks.on('renderChatMessageHTML', TravelCalculator.onRenderChatMessage);
}
