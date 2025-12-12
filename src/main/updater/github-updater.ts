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
    if (mainWindow) {
      mainWindow.webContents.send('update-checking');
    }
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    console.log('[Updater] Доступно обновление:', info.version);
    
    if (mainWindow) {
      // Отправляем событие в renderer для отображения UI обновления
      mainWindow.webContents.send('update-available', info);
      // Автоматически начинаем загрузку
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    console.log('[Updater] Обновления не найдены');
  });

  autoUpdater.on('error', (err: Error) => {
    console.error('[Updater] Ошибка:', err);
    if (mainWindow) {
      mainWindow.webContents.send('update-error', { message: err.message });
    }
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
      // Отправляем событие в renderer
      mainWindow.webContents.send('update-downloaded');
      
      // Автоматически перезапускаем через 3 секунды
      setTimeout(() => {
        autoUpdater.quitAndInstall(false, true);
      }, 3000);
    }
  });
}

export function checkForUpdates() {
  autoUpdater.checkForUpdatesAndNotify();
}

