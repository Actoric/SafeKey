// Конфигурация путей приложения

import * as path from 'path';
import { app } from 'electron';

export const PATHS = {
  userData: app.getPath('userData'),
  database: () => path.join(app.getPath('userData'), 'safekey.db'),
  masterKey: () => path.join(app.getPath('userData'), 'master.key'),
};
