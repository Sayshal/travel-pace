import { exposeApi } from './scripts/api.mjs';
import { MODULE } from './scripts/constants.mjs';
import { registerHooks } from './scripts/hooks.mjs';
import { registerSettings } from './scripts/settings.mjs';
import './styles/travel-pace.css';

Hooks.once('init', () => {
  ATLAS.register(MODULE.ID, { github: 'Sayshal/travel-pace', theme: { scope: '.travel-calculator-window, .travel-pace-app' } });
  ATLAS.log(3, 'Initializing module');
  registerSettings();
  registerHooks();
  exposeApi();
});
