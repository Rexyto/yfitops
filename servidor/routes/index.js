import apiRoutes from './api.js';
import webRoutes from './web.js';
import botRoutes from './bot.js';
import pcRoutes from './pc.js';
import globalRoutes from './global.js';

export function attachRoutes(app) {
  globalRoutes(app);
  webRoutes(app);
  apiRoutes(app);
  botRoutes(app);
  pcRoutes(app);
}
