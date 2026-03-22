import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { APP_CONFIG } from './app.config';

export type AuthType = 'windows-pin' | 'app-pin' | 'none';
export type Theme = 'light' | 'dark';

export interface AppSettings {
  overlayShortcut?: string;
  autoStart?: boolean;
  language?: string;
  authType?: AuthType;
  requireAuthOnStartup?: boolean;
  theme?: Theme;
}

function getSettingsFilePath(): string {
  return path.join(app.getPath('userData'), 'app-settings.json');
}

const DEFAULT_SETTINGS: AppSettings = {
  overlayShortcut: APP_CONFIG.shortcuts.overlay,
  autoStart: false,
  language: 'ru',
  authType: 'windows-pin',
  requireAuthOnStartup: true,
  theme: 'light',
};

export function loadAppSettings(): AppSettings {
  try {
    const settingsFile = getSettingsFilePath();
    if (fs.existsSync(settingsFile)) {
      const data = fs.readFileSync(settingsFile, 'utf-8');
      const settings = JSON.parse(data) as AppSettings;
      return {
        overlayShortcut: settings.overlayShortcut ?? DEFAULT_SETTINGS.overlayShortcut,
        autoStart: settings.autoStart ?? DEFAULT_SETTINGS.autoStart,
        language: settings.language ?? DEFAULT_SETTINGS.language,
        authType: settings.authType ?? DEFAULT_SETTINGS.authType,
        requireAuthOnStartup: settings.requireAuthOnStartup ?? DEFAULT_SETTINGS.requireAuthOnStartup,
        theme: settings.theme ?? DEFAULT_SETTINGS.theme,
      };
    }
  } catch (error) {
    console.error('[AppSettings] Ошибка загрузки настроек:', error);
  }
  return DEFAULT_SETTINGS;
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    const settingsFile = getSettingsFilePath();
    const dir = path.dirname(settingsFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf-8');
    console.log('[AppSettings] Настройки успешно сохранены');
  } catch (error) {
    console.error('[AppSettings] Ошибка сохранения настроек:', error);
    throw error;
  }
}

