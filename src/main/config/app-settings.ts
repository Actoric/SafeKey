import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { APP_CONFIG } from './app.config';

export interface AppSettings {
  overlayShortcut?: string;
  openInOverlay?: boolean;
  autoStart?: boolean;
  startMinimized?: boolean;
  minimizeToTray?: boolean;
  language?: string;
}

function getSettingsFilePath(): string {
  return path.join(app.getPath('userData'), 'app-settings.json');
}

const DEFAULT_SETTINGS: AppSettings = {
  overlayShortcut: APP_CONFIG.shortcuts.overlay,
  openInOverlay: false,
  autoStart: false,
  startMinimized: false,
  minimizeToTray: false,
  language: 'ru',
};

export function loadAppSettings(): AppSettings {
  try {
    const settingsFile = getSettingsFilePath();
    if (fs.existsSync(settingsFile)) {
      const data = fs.readFileSync(settingsFile, 'utf-8');
      const settings = JSON.parse(data) as AppSettings;
      return {
        overlayShortcut: settings.overlayShortcut ?? DEFAULT_SETTINGS.overlayShortcut,
        openInOverlay: settings.openInOverlay ?? DEFAULT_SETTINGS.openInOverlay,
        autoStart: settings.autoStart ?? DEFAULT_SETTINGS.autoStart,
        startMinimized: settings.startMinimized ?? DEFAULT_SETTINGS.startMinimized,
        minimizeToTray: settings.minimizeToTray ?? DEFAULT_SETTINGS.minimizeToTray,
        language: settings.language ?? DEFAULT_SETTINGS.language,
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

