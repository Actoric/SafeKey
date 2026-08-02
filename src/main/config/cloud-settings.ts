import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export type CloudProvider = 'yandex' | 'google';

export interface CloudSettings {
  yandexDisk?: {
    enabled: boolean;
    token?: string;
    path?: string;
  };
  googleDrive?: {
    enabled: boolean;
    token?: string;
    refreshToken?: string;
    folderId?: string;
    tokenExpiresAt?: number;
  };
  status?: {
    lastBackupAt?: string;
    lastError?: string;
    lastProviders?: CloudProvider[];
    recoveryConfigured?: boolean;
  };
}

function getSettingsFilePath(): string {
  return path.join(app.getPath('userData'), 'cloud-settings.json');
}

const DEFAULT_SETTINGS: CloudSettings = {
  yandexDisk: { enabled: false, token: '', path: 'SafeKey' },
  googleDrive: { enabled: false, token: '', refreshToken: '', folderId: '' },
  status: {},
};

export function loadCloudSettings(): CloudSettings {
  try {
    const settingsFile = getSettingsFilePath();
    if (fs.existsSync(settingsFile)) {
      const data = fs.readFileSync(settingsFile, 'utf-8');
      const settings = JSON.parse(data) as CloudSettings;
      return {
        yandexDisk: {
          enabled: settings.yandexDisk?.enabled ?? DEFAULT_SETTINGS.yandexDisk!.enabled,
          token: settings.yandexDisk?.token ?? DEFAULT_SETTINGS.yandexDisk!.token,
          path: settings.yandexDisk?.path || DEFAULT_SETTINGS.yandexDisk!.path,
        },
        googleDrive: {
          enabled: settings.googleDrive?.enabled ?? DEFAULT_SETTINGS.googleDrive!.enabled,
          token: settings.googleDrive?.token ?? DEFAULT_SETTINGS.googleDrive!.token,
          refreshToken: settings.googleDrive?.refreshToken ?? DEFAULT_SETTINGS.googleDrive!.refreshToken,
          folderId: settings.googleDrive?.folderId ?? DEFAULT_SETTINGS.googleDrive!.folderId,
          tokenExpiresAt: settings.googleDrive?.tokenExpiresAt,
        },
        status: {
          lastBackupAt: settings.status?.lastBackupAt,
          lastError: settings.status?.lastError,
          lastProviders: settings.status?.lastProviders,
          recoveryConfigured: settings.status?.recoveryConfigured,
        },
      };
    }
  } catch (error) {
    console.error('[CloudSettings] Ошибка загрузки настроек:', error);
  }
  return structuredClone(DEFAULT_SETTINGS);
}

export function saveCloudSettings(settings: CloudSettings): void {
  try {
    const settingsFile = getSettingsFilePath();
    const dir = path.dirname(settingsFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf-8');
    console.log('[CloudSettings] Настройки успешно сохранены в', settingsFile);
  } catch (error) {
    console.error('[CloudSettings] Ошибка сохранения настроек:', error);
    throw error;
  }
}
