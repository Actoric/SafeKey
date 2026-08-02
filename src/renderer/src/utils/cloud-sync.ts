import { CloudSettings } from '../../../shared/types';

export function isCloudBackupEnabled(settings: CloudSettings): boolean {
  const yandex = settings.yandexDisk?.enabled && (settings.yandexDisk.connected || settings.yandexDisk.token);
  const google = settings.googleDrive?.enabled && (settings.googleDrive.connected || settings.googleDrive.token);
  return !!(yandex || google);
}

/** Фоновая синхронизация; прогресс приходит через событие cloud-sync-progress в MainLayout. */
export async function triggerCloudSync(): Promise<void> {
  try {
    const cloudSettings = await window.electronAPI.getCloudSettings();
    if (!isCloudBackupEnabled(cloudSettings)) return;
    await window.electronAPI.syncToCloud();
  } catch (error) {
    console.error('Ошибка синхронизации с облаком:', error);
  }
}
