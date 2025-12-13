import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import { BrowserWindow, app } from 'electron';

let mainWindow: BrowserWindow | null = null;

export function initializeUpdater(window: BrowserWindow) {
  mainWindow = window;
  
  // Настройка автообновления для GitHub Releases
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'Actoric',
    repo: 'SafeKey',
  });

  // Включаем подробное логирование
  autoUpdater.logger = {
    info: (message: string) => console.log('[Updater Info]', message),
    warn: (message: string) => console.warn('[Updater Warn]', message),
    error: (message: string) => console.error('[Updater Error]', message),
    debug: (message: string) => console.log('[Updater Debug]', message),
  };
  
  // Настройка таймаутов для более быстрой проверки
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  
  console.log('[Updater] Инициализация обновлений для GitHub: Actoric/SafeKey');
  console.log('[Updater] Текущая версия приложения:', app.getVersion());

  // Проверка обновлений при запуске (тихо, без уведомлений)
  // Используем checkForUpdates вместо checkForUpdatesAndNotify для лучшего контроля
  setTimeout(() => {
    checkForUpdates();
  }, 5000); // Задержка 5 секунд после запуска

  // Проверка обновлений каждые 4 часа
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 4 * 60 * 60 * 1000);

  // События автообновления
  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Проверка обновлений...');
    console.log('[Updater] Текущая версия:', app.getVersion());
    if (mainWindow) {
      mainWindow.webContents.send('update-checking');
    }
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    console.log('[Updater] ✅ Доступно обновление!');
    console.log('[Updater] Новая версия:', info.version);
    console.log('[Updater] Текущая версия:', app.getVersion());
    console.log('[Updater] Информация об обновлении:', JSON.stringify(info, null, 2));
    
    if (mainWindow) {
      // Отправляем событие в renderer для отображения UI обновления
      mainWindow.webContents.send('update-available', info);
      // Автоматически начинаем загрузку
      console.log('[Updater] Начинаем загрузку обновления...');
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    console.log('[Updater] ℹ️ Обновления не найдены - программа максимальной версии');
    console.log('[Updater] Текущая версия:', app.getVersion());
    console.log('[Updater] Информация:', JSON.stringify(info, null, 2));
    if (mainWindow) {
      mainWindow.webContents.send('update-not-available');
    }
  });

  autoUpdater.on('error', (err: Error) => {
    console.error('[Updater] ❌ Ошибка обновления:', err);
    console.error('[Updater] Сообщение об ошибке:', err.message);
    console.error('[Updater] Стек ошибки:', err.stack);
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
        console.error('[Updater] Отправляем ошибку в UI:', errorMessage);
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

  autoUpdater.on('update-downloaded', () => {
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
  console.log('[Updater] 🔍 Начинаем проверку обновлений...');
  console.log('[Updater] Текущая версия приложения:', app.getVersion());
  console.log('[Updater] URL обновлений: https://github.com/Actoric/SafeKey/releases');
  console.log('[Updater] Репозиторий: Actoric/SafeKey');
  
  // Устанавливаем таймаут для проверки обновлений (30 секунд)
  const timeout = setTimeout(() => {
    console.log('[Updater] ⏱️ Таймаут проверки обновлений (30 секунд)');
    if (mainWindow) {
      mainWindow.webContents.send('update-not-available');
    }
  }, 30000);

  autoUpdater.checkForUpdates()
    .then((result) => {
      clearTimeout(timeout);
      console.log('[Updater] ✅ Проверка обновлений завершена');
      console.log('[Updater] Результат:', JSON.stringify(result, null, 2));
      if (result?.updateInfo) {
        console.log('[Updater] ✅ Найдена версия:', result.updateInfo.version);
        console.log('[Updater] Текущая версия:', app.getVersion());
        console.log('[Updater] Новая версия больше текущей:', result.updateInfo.version > app.getVersion());
      } else {
        console.log('[Updater] ℹ️ Обновления не найдены - текущая версия:', app.getVersion());
      }
    })
    .catch((error) => {
      clearTimeout(timeout);
      console.error('[Updater] ❌ Ошибка при проверке обновлений');
      console.error('[Updater] Тип ошибки:', error?.constructor?.name);
      console.error('[Updater] Сообщение:', error?.message);
      console.error('[Updater] Полная ошибка:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      const errorMessage = error?.message || error?.toString() || 'Неизвестная ошибка';
      
      // Проверяем, не является ли это просто отсутствием обновлений
      const isNoUpdateError = 
        errorMessage.includes('No update available') ||
        errorMessage.includes('not available') ||
        errorMessage.includes('already the latest version') ||
        errorMessage.includes('latest version') ||
        errorMessage.includes('404') ||
        errorMessage.includes('Not Found') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('network');
      
      if (mainWindow) {
        if (isNoUpdateError) {
          // Это не ошибка, просто нет обновлений или проблемы с сетью
          console.log('[Updater] ℹ️ Обновления не найдены (обработано как отсутствие обновлений)');
          console.log('[Updater] Текущая версия приложения:', app.getVersion());
          mainWindow.webContents.send('update-not-available');
        } else {
          // Реальная ошибка - отправляем только если это не тихая проверка
          console.error('[Updater] ❌ Реальная ошибка при проверке обновлений:', errorMessage);
          mainWindow.webContents.send('update-error', { message: errorMessage });
        }
      }
    });
}

