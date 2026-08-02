import * as os from 'os';
import { ipcMain } from 'electron';
import { loadCloudSettings, saveCloudSettings, type CloudProvider, type CloudSettings } from '../config/cloud-settings';
import { YandexOAuthService } from '../services/yandex-oauth';
import { GoogleOAuthService } from '../services/google-oauth';
import { YandexDiskService } from '../services/yandex-disk';
import {
  checkCloudSync,
  clearCloudRecovery,
  configureCloudRecovery,
  createGoogleProvider,
  getCloudStorageQuota,
  listCloudVersions,
  restoreFromCloud,
  syncToCloud,
} from '../services/cloud-backup';

function normalizeYandexPath(diskPath?: string): string {
  let p = (diskPath || 'SafeKey').trim();
  if (p.startsWith('/')) p = p.substring(1);
  return p || 'SafeKey';
}

export function registerCloudIpc(): void {
  ipcMain.handle('get-cloud-settings', async () => {
    try {
      const settings = loadCloudSettings();
      // Не отдаём токены в renderer — только факт подключения
      return {
        yandexDisk: {
          enabled: !!settings.yandexDisk?.enabled,
          connected: !!settings.yandexDisk?.token,
          path: settings.yandexDisk?.path || 'SafeKey',
        },
        googleDrive: {
          enabled: !!settings.googleDrive?.enabled,
          connected: !!settings.googleDrive?.token,
          folderId: settings.googleDrive?.folderId || '',
        },
        status: settings.status || {},
      };
    } catch (error) {
      console.error('[Main] Ошибка загрузки облачных настроек:', error);
      return {
        yandexDisk: { enabled: false, connected: false, path: 'SafeKey' },
        googleDrive: { enabled: false, connected: false, folderId: '' },
        status: {},
      };
    }
  });

  ipcMain.handle('save-cloud-settings', async (_, settings: CloudSettings) => {
    try {
      const current = loadCloudSettings();
      // Не затираем токены пустыми значениями из UI (токены скрыты)
      const merged: CloudSettings = {
        yandexDisk: {
          enabled: settings.yandexDisk?.enabled ?? false,
          token: settings.yandexDisk?.token || current.yandexDisk?.token || '',
          path: settings.yandexDisk?.path || current.yandexDisk?.path || 'SafeKey',
        },
        googleDrive: {
          enabled: settings.googleDrive?.enabled ?? false,
          token: settings.googleDrive?.token || current.googleDrive?.token || '',
          refreshToken: settings.googleDrive?.refreshToken || current.googleDrive?.refreshToken || '',
          folderId: settings.googleDrive?.folderId || current.googleDrive?.folderId || '',
          tokenExpiresAt: settings.googleDrive?.tokenExpiresAt ?? current.googleDrive?.tokenExpiresAt,
        },
        status: settings.status ?? current.status,
      };
      saveCloudSettings(merged);
      console.log('[Main] Облачные настройки сохранены');
      return { success: true };
    } catch (error) {
      console.error('[Main] Ошибка сохранения облачных настроек:', error);
      throw error;
    }
  });

  ipcMain.handle('authorize-yandex-disk', async () => {
    try {
      console.log('[Main] Запуск авторизации Яндекс.Диска...');
      const token = await YandexOAuthService.authorize();
      if (token) {
        const cloudSettings = loadCloudSettings();
        const diskPath = normalizeYandexPath(cloudSettings.yandexDisk?.path);

        cloudSettings.yandexDisk = {
          ...cloudSettings.yandexDisk,
          enabled: true,
          token,
          path: diskPath,
        };
        saveCloudSettings(cloudSettings);

        try {
          const yandexDisk = new YandexDiskService(token, diskPath);
          const files = await yandexDisk.listFiles();
          const backupFiles = files.filter(
            (f) => f.startsWith('safekey_backup') && (f.endsWith('.dat') || f.endsWith('.db'))
          );

          if (backupFiles.length > 0) {
            return {
              success: true,
              connected: true,
              hasExistingFiles: true,
              files: backupFiles,
            };
          }
        } catch (checkError) {
          console.warn('[Main] Ошибка проверки директории на Яндекс.Диске:', checkError);
        }

        return { success: true, connected: true, hasExistingFiles: false };
      }
      return { success: false, connected: false };
    } catch (error) {
      console.error('[Main] Ошибка авторизации Яндекс.Диска:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Неизвестная ошибка' };
    }
  });

  ipcMain.handle('authorize-google-drive', async () => {
    try {
      console.log('[Main] Запуск авторизации Google Drive...');
      const auth = await GoogleOAuthService.authorize();
      if (auth?.accessToken) {
        const cloudSettings = loadCloudSettings();
        cloudSettings.googleDrive = {
          ...cloudSettings.googleDrive,
          enabled: true,
          token: auth.accessToken,
          refreshToken: auth.refreshToken || cloudSettings.googleDrive?.refreshToken || '',
          tokenExpiresAt: auth.expiresIn
            ? Date.now() + auth.expiresIn * 1000
            : cloudSettings.googleDrive?.tokenExpiresAt,
        };

        try {
          const google = await createGoogleProvider(cloudSettings);
          if (google) {
            cloudSettings.googleDrive!.folderId = google.folderId;
          }
        } catch (folderError) {
          console.warn('[Main] Не удалось создать папку SafeKey на Google Drive:', folderError);
        }

        saveCloudSettings(cloudSettings);

        let hasExistingFiles = false;
        let files: string[] = [];
        try {
          const google = await createGoogleProvider(cloudSettings);
          if (google) {
            const listed = await google.service.listFiles();
            files = listed.filter(
              (f) => f.startsWith('safekey_backup') && (f.endsWith('.dat') || f.endsWith('.db'))
            );
            hasExistingFiles = files.length > 0;
          }
        } catch {
          /* ignore */
        }

        return { success: true, connected: true, hasExistingFiles, files };
      }
      return { success: false, connected: false };
    } catch (error) {
      console.error('[Main] Ошибка авторизации Google Drive:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Неизвестная ошибка' };
    }
  });

  ipcMain.handle('disconnect-cloud-provider', async (_, provider: CloudProvider) => {
    try {
      const settings = loadCloudSettings();
      if (provider === 'yandex') {
        settings.yandexDisk = { enabled: false, token: '', path: settings.yandexDisk?.path || 'SafeKey' };
      } else {
        settings.googleDrive = {
          enabled: false,
          token: '',
          refreshToken: '',
          folderId: '',
        };
      }
      saveCloudSettings(settings);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Неизвестная ошибка' };
    }
  });

  ipcMain.handle('sync-to-cloud', async () => {
    try {
      return await syncToCloud();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      console.error('[CloudSync] Ошибка синхронизации с облаком:', error);
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle('get-windows-username', async () => {
    try {
      return os.userInfo().username;
    } catch (error) {
      console.error('[Main] Ошибка получения имени пользователя:', error);
      return 'Пользователь';
    }
  });

  ipcMain.handle('check-cloud-sync', async () => {
    try {
      return await checkCloudSync();
    } catch (error) {
      console.error('[CloudSync] Ошибка проверки синхронизации:', error);
      return {
        synced: false,
        message: 'Ошибка проверки: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка'),
      };
    }
  });

  ipcMain.handle(
    'restore-from-cloud',
    async (
      _,
      provider: CloudProvider = 'yandex',
      legacyWindowsUsername?: string,
      backupFileName?: string,
      recoveryCode?: string
    ) => {
      return restoreFromCloud(provider, legacyWindowsUsername, backupFileName, recoveryCode);
    }
  );

  ipcMain.handle('list-cloud-versions', async (_, provider: CloudProvider = 'yandex') => {
    return listCloudVersions(provider);
  });

  ipcMain.handle('get-cloud-storage-quota', async (_, provider?: CloudProvider) => {
    return getCloudStorageQuota(provider);
  });

  ipcMain.handle('configure-cloud-recovery', async (_, recoveryCode: string) => {
    return configureCloudRecovery(recoveryCode);
  });

  ipcMain.handle('clear-cloud-recovery', async () => {
    return clearCloudRecovery();
  });

  // Обратная совместимость
  ipcMain.handle('restore-from-yandex-disk', async (_, legacyWindowsUsername?: string) => {
    return restoreFromCloud('yandex', legacyWindowsUsername);
  });
}
