import { ipcMain } from 'electron';
import { checkForUpdates, downloadUpdate, installUpdate } from '../updater/github-updater';

export function registerUpdaterIpc(): void {
  ipcMain.handle('check-for-updates', async () => {
    try {
      checkForUpdates();
      return { success: true };
    } catch (error) {
      console.error('[Main] Ошибка проверки обновлений:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('download-update', async () => {
    try {
      downloadUpdate();
      return { success: true };
    } catch (error) {
      console.error('[Main] Ошибка загрузки обновления:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('install-update', async () => {
    try {
      installUpdate();
      return { success: true };
    } catch (error) {
      console.error('[Main] Ошибка установки обновления:', error);
      return { success: false, error: (error as Error).message };
    }
  });
}
