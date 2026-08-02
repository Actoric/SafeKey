import { app, BrowserWindow, globalShortcut } from 'electron';
import { runtime } from './runtime-context';
import { registerOverlayShortcut } from './overlay-shortcut';
import { registerUpdaterIpc } from './ipc/updater-ipc';
import { registerAppShellIpc } from './ipc/app-shell-ipc';
import { registerAuthIpc } from './ipc/auth-ipc';
import { registerEncryptionIpc } from './ipc/encryption-ipc';
import { registerVaultIpc } from './ipc/vault-ipc';
import { registerCloudIpc } from './ipc/cloud-ipc';
import { registerDatabaseIpc } from './ipc/database-ipc';
import { createMainWindow, createOverlayWindow, wireWindowsEnsureTray } from './windows';
import { createTrayFromContext } from './tray-manager';
import { loadAppSettings } from './config/app-settings';
import { WindowsPinAuthService } from './auth/windows-pin-auth';
import { AppPinAuthService } from './auth/app-pin-auth';

// Проверка на единственный экземпляр приложения
// ВАЖНО: это должно быть ДО app.whenReady()
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Если уже есть запущенный экземпляр, закрываем этот
  console.log('[Main] Другой экземпляр уже запущен, закрываем этот');
  app.quit();
  process.exit(0);
} else {
  // Обработчик второго экземпляра - фокусируемся на существующем окне
  app.on('second-instance', () => {
    console.log('[Main] Попытка запуска второго экземпляра, фокусируем существующий');
    // Если окно существует, показываем и фокусируем его
    if (runtime.mainWindow) {
      if (runtime.mainWindow.isMinimized()) {
        runtime.mainWindow.restore();
      }
      if (runtime.mainWindow.isVisible()) {
        runtime.mainWindow.focus();
      } else {
        runtime.mainWindow.show();
        runtime.mainWindow.focus();
      }
    } else {
      // Если окна нет, создаем новое (но это не должно происходить)
      console.log('[Main] Окно не существует, создаем новое');
      createMainWindow();
    }
  });
}

// Устанавливаем AppUserModelId для Windows ДО app.whenReady()
// ВАЖНО: это должно быть установлено как можно раньше, до создания окна
if (process.platform === 'win32') {
  // Используем уникальный AppUserModelId для правильной группировки окон в панели задач
  // и правильного отображения иконки в Windows
  app.setAppUserModelId('com.safekey.app');
  console.log('[Main] AppUserModelId установлен: com.safekey.app');
  console.log('[Main] Путь к exe файлу:', process.execPath);
}

app.whenReady().then(() => {

  // Создаем главное окно (оно само решит показываться или нет в зависимости от автозапуска)
  createMainWindow();

  // Регистрация глобальной горячей клавиши для оверлея
  registerOverlayShortcut(createOverlayWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Сбрасываем состояние авторизации при выходе
    runtime.isUserAuthenticated = false;
    app.quit();
  }
});

app.on('will-quit', () => {
  // Сбрасываем состояние авторизации при выходе
  runtime.isUserAuthenticated = false;
  globalShortcut.unregisterAll();
});

// IPC обработчики для работы с базой данных
registerUpdaterIpc();
registerAuthIpc();
registerEncryptionIpc();
registerVaultIpc();
registerCloudIpc();
registerDatabaseIpc();

// Универсальная функция проверки авторизации
async function performAuth(authType: string = 'windows-pin'): Promise<boolean> {
  const appSettings = loadAppSettings();
  const type = authType || appSettings.authType || 'windows-pin';

  console.log('[Main] Выполняем авторизацию типа:', type);

  if (type === 'none') {
    console.log('[Main] Авторизация отключена');
    runtime.isUserAuthenticated = true;
    return true;
  }

  if (type === 'app-pin') {
    // Для собственного PIN-кода нужно запросить его через диалог
    // Пока возвращаем false, чтобы показать диалог ввода PIN
    console.log('[Main] Требуется PIN-код приложения');
    return false;
  }

  // Windows PIN по умолчанию
  if (!runtime.windowsPinAuthService) {
    runtime.windowsPinAuthService = new WindowsPinAuthService();
  }
  const result = await runtime.windowsPinAuthService.verifyPinCode();
  if (result) {
    runtime.isUserAuthenticated = true;
  }
  return result;
}

function ensureTray(): void {
  if (runtime.tray) return;
  createTrayFromContext({
    getMainWindow: () => runtime.mainWindow,
    getOverlayWindow: () => runtime.overlayWindow,
    getTray: () => runtime.tray,
    setTray: (t) => {
      runtime.tray = t;
    },
    getAppIcon: () => runtime.appIcon,
    getIsUserAuthenticated: () => runtime.isUserAuthenticated,
    createMainWindow,
    performAuth,
    destroyMainAndOverlay: () => {
      if (runtime.mainWindow) {
        runtime.mainWindow.destroy();
        runtime.mainWindow = null;
      }
      if (runtime.overlayWindow) {
        runtime.overlayWindow.destroy();
        runtime.overlayWindow = null;
      }
    },
  });
}

wireWindowsEnsureTray(ensureTray);
registerAppShellIpc({ ensureTray });
