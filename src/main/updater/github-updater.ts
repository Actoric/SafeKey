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

  if (!app.isPackaged) {
    console.log('[Updater] dev/unpacked: обновления отключены');
    return;
  }

  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'Actoric',
    repo: 'SafeKey',
  });

  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  (autoUpdater as any).verifySignatureOnUpdate = false;

  autoUpdater.logger = {
    info: (message: string) => console.log('[Updater Info]', message),
    warn: (message: string) => console.warn('[Updater Warn]', message),
    error: (message: string) => console.error('[Updater Error]', message),
    debug: (message: string) => console.log('[Updater Debug]', message),
  };

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  console.log('[Updater] GitHub: Actoric/SafeKey, версия:', app.getVersion());

  setTimeout(() => {
    checkForUpdates();
  }, 1500);

  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 4 * 60 * 60 * 1000);

  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Проверка обновлений..., текущая:', app.getVersion());
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    const newVersion = info?.version || '';
    console.log('[Updater] Доступно обновление, загрузка:', newVersion);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] Обновлений нет, актуальная версия:', app.getVersion());
  });

  autoUpdater.on('error', (err: Error) => {
    const errorMessage = err.message || err.toString() || 'Неизвестная ошибка';
    console.error('[Updater] Ошибка:', errorMessage);
  });

  let downloadProgressStarted = false;
  autoUpdater.on('download-progress', (progressObj: ProgressInfo) => {
    if (!downloadProgressStarted) {
      downloadProgressStarted = true;
      console.log('[Updater] Загрузка началась.');
    }
    const percent = progressObj.percent || 0;
    const transferred = progressObj.transferred || 0;
    const total = progressObj.total || 0;
    console.log(`[Updater] Прогресс: ${percent.toFixed(2)}% (${transferred}/${total})`);
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    console.log('[Updater] Обновление загружено:', info.version);
    const delayMs = 800;
    console.log(`[Updater] Автоустановка через ${delayMs} мс...`);
    setTimeout(() => {
      console.log('[Updater] Установка и перезапуск...');
      installUpdate();
    }, delayMs);
  });
}

export function checkForUpdates() {
  if (!app.isPackaged) {
    console.log('[Updater] Проверка недоступна в dev/unpacked');
    return;
  }

  console.log('[Updater] Проверка..., версия:', app.getVersion());

  autoUpdater
    .checkForUpdates()
    .then((result) => {
      console.log('[Updater] Проверка завершена');
      if (result?.updateInfo) {
        console.log('[Updater] Найдена версия:', result.updateInfo.version);
      }
    })
    .catch((error) => {
      console.error('[Updater] Ошибка проверки:', error);
    });
}

export function downloadUpdate() {
  if (!app.isPackaged) {
    console.log('[Updater] Загрузка недоступна в dev/unpacked');
    return;
  }

  console.log('[Updater] Загрузка обновления...');
  autoUpdater
    .downloadUpdate()
    .then(() => console.log('[Updater] Загрузка начата'))
    .catch((error) => console.error('[Updater] Ошибка загрузки:', error));
}

export function installUpdate() {
  if (!app.isPackaged) {
    console.log('[Updater] Установка недоступна в dev/unpacked');
    return;
  }

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy();
    overlayWindow = null;
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
    mainWindow = null;
  }

  if (tray && !tray.isDestroyed()) {
    tray.destroy();
    tray = null;
  }

  setTimeout(() => {
    autoUpdater.quitAndInstall(true, true);
  }, 500);
}
