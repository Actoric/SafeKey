import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import { BrowserWindow, app, Tray } from 'electron';

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;


export function updateWindowReferences(window?: BrowserWindow | null, overlay?: BrowserWindow | null, trayInstance?: Tray | null) {
  if (window !== undefined) mainWindow = window;
  if (overlay !== undefined) overlayWindow = overlay;
  if (trayInstance !== undefined) tray = trayInstance;
}

export function initializeUpdater(window: BrowserWindow, overlay?: BrowserWindow | null, trayInstance?: Tray | null) {
  mainWindow = window;
  overlayWindow = overlay || null;
  tray = trayInstance || null;

  // ❗ ВАЖНО: запрещаем обновления в dev / unpacked
  if (!app.isPackaged) {
    console.log('[Updater] ❌ Приложение не установлено (dev/unpacked) — обновления отключены');
    // НЕ отправляем ошибку в UI, чтобы не блокировать интерфейс
    // Просто молча отключаем updater
    return;
  }

  // Настройка автообновления для GitHub Releases
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'Actoric',
    repo: 'SafeKey',
  });

  // Включаем детальное логирование для отладки
  autoUpdater.allowPrerelease = false; // Только стабильные релизы
  autoUpdater.allowDowngrade = false; // Не разрешаем откат версий

  // Отключаем проверку цифровой подписи (приложение не подписано)
  (autoUpdater as any).verifySignatureOnUpdate = false;

  // Включаем подробное логирование
  autoUpdater.logger = {
    info: (message: string) => console.log('[Updater Info]', message),
    warn: (message: string) => console.warn('[Updater Warn]', message),
    error: (message: string) => console.error('[Updater Error]', message),
    debug: (message: string) => console.log('[Updater Debug]', message),
  };

  // Настройка таймаутов для более быстрой проверки
  // autoDownload = false позволяет контролировать момент начала загрузки
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  console.log('[Updater] Инициализация обновлений для GitHub: Actoric/SafeKey');
  console.log('[Updater] Текущая версия приложения:', app.getVersion());

  // Проверка обновлений при запуске (тихо, без уведомлений)
  setTimeout(() => {
    checkForUpdates();
  }, 5000); // Задержка 5 секунд после запуска

  // Проверка обновлений каждые 4 часа
  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 4 * 60 * 60 * 1000);

  // События автообновления
  autoUpdater.on('checking-for-update', () => {
    const version = app.getVersion();
    console.log('[Updater] Проверка обновлений...');
    console.log('[Updater] Текущая версия:', version);
    if (mainWindow) {
      mainWindow.webContents.send('update-checking');
    }
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    const currentVersion = app.getVersion();
    const newVersion = info?.version || '';
    console.log('[Updater] ✅ Доступно обновление!');
    console.log('[Updater] Новая версия:', newVersion);
    console.log('[Updater] Текущая версия:', currentVersion);
    
    if (mainWindow && info) {
      // Отправляем событие в renderer для отображения UI обновления
      const updateInfo = {
        version: newVersion || info.version || '',
        releaseDate: info.releaseDate || '',
        releaseName: info.releaseName || '',
        releaseNotes: info.releaseNotes || ''
      };
      
      mainWindow.webContents.send('update-available', updateInfo);
    }
  });

  autoUpdater.on('update-not-available', (_info: UpdateInfo) => {
    const currentVersion = app.getVersion();
    console.log('[Updater] ℹ️ Обновления не найдены - программа максимальной версии');
    console.log('[Updater] Текущая версия:', currentVersion);
    if (mainWindow) {
      mainWindow.webContents.send('update-not-available');
    }
  });

  autoUpdater.on('error', (err: Error) => {
    const errorMessage = err.message || err.toString() || 'Неизвестная ошибка';
    console.error('[Updater] ❌ Ошибка обновления:', errorMessage);
    
    if (mainWindow) {
      // Игнорируем ошибки, связанные с отсутствием обновлений
      const isNoUpdateError = 
        errorMessage.includes('No update available') ||
        errorMessage.includes('not available') ||
        errorMessage.includes('already the latest version');
      
      if (!isNoUpdateError) {
        mainWindow.webContents.send('update-error', { 
          message: errorMessage,
          error: errorMessage
        });
      }
    }
  });

  // Отслеживание прогресса загрузки
  let downloadProgressStarted = false;
  autoUpdater.on('download-progress', (progressObj: ProgressInfo) => {
    if (!downloadProgressStarted) {
      downloadProgressStarted = true;
      console.log('[Updater] ✅ Загрузка началась!');
    }
    
    const percent = progressObj.percent || 0;
    const transferred = progressObj.transferred || 0;
    const total = progressObj.total || 0;
    
    console.log(`[Updater] Прогресс: ${percent.toFixed(2)}% (${transferred}/${total} байт)`);
    
    if (mainWindow) {
      mainWindow.webContents.send('update-download-progress', {
        percent,
        transferred,
        total,
        bytesPerSecond: progressObj.bytesPerSecond || 0
      });
    }
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    console.log('[Updater] ✅ Обновление загружено успешно!');
    console.log('[Updater] Версия:', info.version);
    
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', {
        version: info.version,
        releaseName: info.releaseName,
        releaseNotes: info.releaseNotes
      });
    }

    // Автоматически устанавливаем обновление через 3 секунды после загрузки
    console.log('[Updater] Автоматическая установка обновления через 3 секунды...');
    setTimeout(() => {
      console.log('[Updater] Устанавливаем обновление и перезапускаем приложение...');
      installUpdate();
    }, 3000); // 3 секунды задержка, чтобы пользователь успел увидеть сообщение
  });
}

export function checkForUpdates() {
  if (!app.isPackaged) {
    console.log('[Updater] ❌ Проверка обновлений недоступна в dev/unpacked режиме');
    return;
  }

  console.log('[Updater] 🔍 Начинаем проверку обновлений...');
  console.log('[Updater] Текущая версия:', app.getVersion());
  console.log('[Updater] URL: https://github.com/Actoric/SafeKey/releases');
  
  autoUpdater.checkForUpdates()
    .then((result) => {
      console.log('[Updater] ✅ Проверка обновлений завершена');
      if (result && result.updateInfo) {
        console.log('[Updater] Найдена версия:', result.updateInfo.version);
      }
    })
    .catch((error) => {
      console.error('[Updater] ❌ Ошибка при проверке обновлений:', error);
    });
}

export function downloadUpdate() {
  if (!app.isPackaged) {
    console.log('[Updater] ❌ Загрузка обновлений недоступна в dev/unpacked режиме');
    if (mainWindow) {
      mainWindow.webContents.send('update-error', {
        message: 'Загрузка обновлений доступна только в установленной версии приложения',
        error: 'App not packaged'
      });
    }
    return;
  }

  console.log('[Updater] Начинаем загрузку обновления...');
  autoUpdater.downloadUpdate()
    .then(() => {
      console.log('[Updater] ✅ Загрузка начата');
    })
    .catch((error) => {
      console.error('[Updater] ❌ Ошибка при начале загрузки:', error);
      if (mainWindow) {
        mainWindow.webContents.send('update-error', {
          message: `Ошибка при начале загрузки: ${error?.message || error}`,
          error: error?.message || error?.toString() || 'Unknown error'
        });
      }
    });
}

export function installUpdate() {
  if (!app.isPackaged) {
    console.log('[Updater] ❌ Установка обновлений недоступна в dev/unpacked режиме');
    return;
  }

  console.log('[Updater] Закрываем все окна и трей перед установкой обновления...');
  
  // Закрываем overlay окно, если оно открыто
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    console.log('[Updater] Закрываем overlay окно...');
    overlayWindow.destroy();
    overlayWindow = null;
  }

  // Закрываем главное окно, если оно открыто
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('[Updater] Закрываем главное окно...');
    mainWindow.destroy();
    mainWindow = null;
  }

  // Уничтожаем трей, если он существует
  if (tray && !tray.isDestroyed()) {
    console.log('[Updater] Уничтожаем трей...');
    tray.destroy();
    tray = null;
  }

  // Даем время на закрытие всех окон
  setTimeout(() => {
    console.log('[Updater] Устанавливаем обновление и перезапускаем приложение...');
    // Первый параметр: isSilent - false (показывать UI установщика)
    // Второй параметр: isForceRunAfter - true (запустить приложение после установки)
    autoUpdater.quitAndInstall(false, true);
  }, 500); // Небольшая задержка для гарантированного закрытия окон
}
