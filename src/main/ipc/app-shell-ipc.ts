import { app, ipcMain, shell, clipboard } from 'electron';
import { APP_VERSION } from '../version-info';
import { runtime } from '../runtime-context';
import { APP_CONFIG } from '../config/app.config';
import { loadAppSettings, saveAppSettings } from '../config/app-settings';
import { setAutoLaunch } from '../auto-launch';
import { registerOverlayShortcut } from '../overlay-shortcut';
import { createOverlayWindow } from '../windows';
import { updateWindowReferences } from '../updater/github-updater';
import { showCloseDialog } from '../dialogs/close-dialog';
import type { AppSettings } from '../config/app-settings';

export type AppShellIpcDeps = {
  ensureTray: () => void;
};

export function registerAppShellIpc(deps: AppShellIpcDeps): void {
  const { ensureTray } = deps;

  ipcMain.handle('window-minimize', () => {
    if (runtime.mainWindow) {
      runtime.mainWindow.hide();
      if (!runtime.tray) {
        ensureTray();
      }
    }
  });

  ipcMain.handle('window-maximize', () => {
    if (runtime.mainWindow) {
      if (runtime.mainWindow.isMaximized()) {
        runtime.mainWindow.unmaximize();
      } else {
        runtime.mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('window-close', async () => {
    if (runtime.mainWindow) {
      const choice = await showCloseDialog();

      if (choice === 'minimize') {
        if (runtime.mainWindow) {
          runtime.mainWindow.hide();
          if (!runtime.tray) {
            ensureTray();
          }
        }
      } else {
        if (runtime.mainWindow) {
          runtime.mainWindow.destroy();
          runtime.mainWindow = null;
        }
        if (runtime.overlayWindow) {
          runtime.overlayWindow.destroy();
          runtime.overlayWindow = null;
        }
        if (runtime.tray) {
          runtime.tray.destroy();
          runtime.tray = null;
        }
        app.quit();
      }
    }
  });

  ipcMain.handle('get-app-settings', async () => {
    try {
      return loadAppSettings();
    } catch (error) {
      console.error('[Main] Ошибка загрузки настроек приложения:', error);
      return {
        overlayShortcut: APP_CONFIG.shortcuts.overlay,
        autoStart: false,
        language: 'ru',
      };
    }
  });

  ipcMain.handle('get-app-version', async () => APP_VERSION);

  ipcMain.handle('save-app-settings', async (_, settings: AppSettings) => {
    try {
      const oldSettings = loadAppSettings();
      saveAppSettings(settings);

      registerOverlayShortcut(createOverlayWindow);

      if (settings.autoStart !== oldSettings.autoStart) {
        await setAutoLaunch(settings.autoStart || false);
      }

      if (settings.autoStart && !runtime.tray) {
        ensureTray();
      } else if (!settings.autoStart && runtime.tray) {
        runtime.tray.destroy();
        runtime.tray = null;
        updateWindowReferences(runtime.mainWindow, runtime.overlayWindow, runtime.tray);
      }

      return { success: true };
    } catch (error) {
      console.error('[Main] Ошибка сохранения настроек приложения:', error);
      throw error;
    }
  });

  ipcMain.handle('open-overlay', async () => {
    await createOverlayWindow();
  });

  ipcMain.handle('copy-to-clipboard', async (_, text: string) => {
    clipboard.writeText(text);
    return { success: true };
  });

  ipcMain.handle('open-url', async (_, url: string) => {
    await shell.openExternal(url);
    return { success: true };
  });
}
