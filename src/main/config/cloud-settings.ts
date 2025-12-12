import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

// Определяем тип локально, так как shared/types может быть недоступен из main процесса
export interface CloudSettings {
  yandexDisk?: {
    enabled: boolean;
    token?: string;
    path?: string;
  };
  googleDrive?: {
    enabled: boolean;
    token?: string;
    folderId?: string;
  };
}

function getSettingsFilePath(): string {
  return path.join(app.getPath('userData'), 'cloud-settings.json');
}

const DEFAULT_SETTINGS: CloudSettings = {
  yandexDisk: { enabled: false, token: '', path: '' },
  googleDrive: { enabled: false, token: '', folderId: '' },
};

export function loadCloudSettings(): CloudSettings {
  try {
    const settingsFile = getSettingsFilePath();
    if (fs.existsSync(settingsFile)) {
      const data = fs.readFileSync(settingsFile, 'utf-8');
      const settings = JSON.parse(data) as CloudSettings;
      // Объединяем с дефолтными настройками на случай, если структура изменилась
      return {
        yandexDisk: {
          enabled: settings.yandexDisk?.enabled ?? DEFAULT_SETTINGS.yandexDisk!.enabled,
          token: settings.yandexDisk?.token ?? DEFAULT_SETTINGS.yandexDisk!.token,
          path: settings.yandexDisk?.path ?? DEFAULT_SETTINGS.yandexDisk!.path,
        },
        googleDrive: {
          enabled: settings.googleDrive?.enabled ?? DEFAULT_SETTINGS.googleDrive!.enabled,
          token: settings.googleDrive?.token ?? DEFAULT_SETTINGS.googleDrive!.token,
          folderId: settings.googleDrive?.folderId ?? DEFAULT_SETTINGS.googleDrive!.folderId,
        },
      };
    }
  } catch (error) {
    console.error('[CloudSettings] Ошибка загрузки настроек:', error);
  }
  return DEFAULT_SETTINGS;
}

export function saveCloudSettings(settings: CloudSettings): void {
  try {
    const settingsFile = getSettingsFilePath();
    // Убеждаемся, что директория существует
    const dir = path.dirname(settingsFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Сохраняем настройки
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf-8');
    console.log('[CloudSettings] Настройки успешно сохранены в', settingsFile);
  } catch (error) {
    console.error('[CloudSettings] Ошибка сохранения настроек:', error);
    throw error;
  }
}

