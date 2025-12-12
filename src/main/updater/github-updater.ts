import { autoUpdater, UpdateInfo, UpdateDownloadedEvent, ProgressInfo } from 'electron-updater';
import { dialog, BrowserWindow } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;

export function initializeUpdater(window: BrowserWindow) {
  mainWindow = window;
  
  // Настройка автообновления для GitHub Releases
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'Actoric',
    repo: 'SafeKey',
  });

  // Проверка обновлений при запуске (тихо, без уведомлений)
  autoUpdater.checkForUpdatesAndNotify();

  // Проверка обновлений каждые 4 часа
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 4 * 60 * 60 * 1000);

  // События автообновления
  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Проверка обновлений...');
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    console.log('[Updater] Доступно обновление:', info.version);
    
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Доступно обновление',
        message: `Доступна новая версия ${info.version}`,
        detail: info.releaseNotes ? String(info.releaseNotes) : 'Обновление будет загружено в фоновом режиме.',
        buttons: ['Установить сейчас', 'Позже'],
        defaultId: 0,
        cancelId: 1,
      }).then((result) => {
        if (result.response === 0) {
          // Пользователь выбрал "Установить сейчас"
          autoUpdater.downloadUpdate();
        }
      });
    }
  });

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    console.log('[Updater] Обновления не найдены');
  });

  autoUpdater.on('error', (err: Error) => {
    console.error('[Updater] Ошибка:', err);
  });

  autoUpdater.on('download-progress', (progressObj: ProgressInfo) => {
    let logMessage = `[Updater] Скорость: ${progressObj.bytesPerSecond} - Загружено ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
    console.log(logMessage);
    
    // Можно отправить прогресс в renderer процесс для отображения
    if (mainWindow) {
      mainWindow.webContents.send('update-download-progress', progressObj);
    }
  });

  autoUpdater.on('update-downloaded', (info: UpdateDownloadedEvent) => {
    console.log('[Updater] Обновление загружено');
    
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Обновление готово',
        message: 'Обновление загружено и готово к установке.',
        detail: 'Приложение будет перезапущено для установки обновления.',
        buttons: ['Перезапустить сейчас', 'Позже'],
        defaultId: 0,
        cancelId: 1,
      }).then((result) => {
        if (result.response === 0) {
          // Пользователь выбрал "Перезапустить сейчас"
          autoUpdater.quitAndInstall(false, true);
        }
      });
    }
  });
}

export function checkForUpdates() {
  autoUpdater.checkForUpdatesAndNotify();
}

