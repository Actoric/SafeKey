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
    console.log('[Updater] Обновления не найдены - программа максимальной версии');
    if (mainWindow) {
      mainWindow.webContents.send('update-not-available');
    }
  });

  autoUpdater.on('error', (err: Error) => {
    console.error('[Updater] Ошибка:', err);
    if (mainWindow) {
      const errorMessage = err.message || err.toString() || 'Неизвестная ошибка';
      
      // Проверяем, не является ли это просто отсутствием обновлений
      const isNoUpdateError = 
        errorMessage.includes('No update available') ||
        errorMessage.includes('not available') ||
        errorMessage.includes('already the latest version') ||
        errorMessage.includes('latest version') ||
        errorMessage.includes('404') ||
        errorMessage.includes('Not Found');
      
      if (isNoUpdateError) {
        // Это не ошибка, просто нет обновлений
        console.log('[Updater] Обновления не найдены (обработано как отсутствие обновлений)');
        mainWindow.webContents.send('update-not-available');
      } else {
        // Реальная ошибка
        mainWindow.webContents.send('update-error', { message: errorMessage });
      }
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
  autoUpdater.checkForUpdates().catch((error) => {
    console.error('[Updater] Ошибка при проверке обновлений:', error);
    const errorMessage = error?.message || error?.toString() || 'Неизвестная ошибка';
    
    // Проверяем, не является ли это просто отсутствием обновлений
    const isNoUpdateError = 
      errorMessage.includes('No update available') ||
      errorMessage.includes('not available') ||
      errorMessage.includes('already the latest version') ||
      errorMessage.includes('latest version') ||
      errorMessage.includes('404') ||
      errorMessage.includes('Not Found');
    
    if (mainWindow) {
      if (isNoUpdateError) {
        // Это не ошибка, просто нет обновлений
        console.log('[Updater] Обновления не найдены (обработано как отсутствие обновлений)');
        mainWindow.webContents.send('update-not-available');
      } else {
        // Реальная ошибка - отправляем только если это не тихая проверка
        console.error('[Updater] Реальная ошибка при проверке обновлений:', errorMessage);
        mainWindow.webContents.send('update-error', { message: errorMessage });
      }
    }
  });
}

