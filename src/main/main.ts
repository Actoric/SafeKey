import { app, BrowserWindow, globalShortcut, ipcMain, screen, shell, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
// Получаем версию из package.json
const packageJsonPath = path.join(__dirname, '../../package.json');
let appVersion = '1.0.0';
try {
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(packageJsonContent);
  appVersion = packageJson.version || '1.0.0';
} catch (error) {
  console.error('[Main] Ошибка чтения package.json:', error);
}
import { DatabaseService } from './database/database';
import { EncryptionService } from './encryption/encryption';
import { APP_CONFIG } from './config/app.config';
import { PATHS } from './config/paths.config';
import { loadCloudSettings, saveCloudSettings } from './config/cloud-settings';
import { loadAppSettings, saveAppSettings } from './config/app-settings';
import { YandexDiskService } from './services/yandex-disk';
import { YandexOAuthService } from './services/yandex-oauth';
import { GoogleOAuthService } from './services/google-oauth';
import { WindowsPinAuthService } from './auth/windows-pin-auth';
import { initializeUpdater, checkForUpdates, downloadUpdate, installUpdate, updateWindowReferences } from './updater/github-updater';
import { clipboard } from 'electron';
import AutoLaunch from 'auto-launch';

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let appIcon: Electron.NativeImage | null = null; // Сохраняем иконку приложения
let currentOverlayShortcut: string = APP_CONFIG.shortcuts.overlay;
let autoLauncher: AutoLaunch | null = null;

function createMainWindow() {
  // Путь к иконке приложения
  let iconPath: string | undefined;
  if (process.env.NODE_ENV === 'development') {
    const devIconPath = path.join(__dirname, '../../build/icon.ico');
    if (fs.existsSync(devIconPath)) {
      iconPath = devIconPath;
    }
  } else {
    // В production пробуем разные пути
    const possiblePaths = [
      path.join(process.resourcesPath, 'build/icon.ico'),
      path.join(process.resourcesPath, 'app/build/icon.ico'),
      path.join(__dirname, '../build/icon.ico'),
    ];
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        iconPath = possiblePath;
        break;
      }
    }
  }

  mainWindow = new BrowserWindow({
    width: APP_CONFIG.window.main.width,
    height: APP_CONFIG.window.main.height,
    minWidth: APP_CONFIG.window.main.minWidth,
    minHeight: APP_CONFIG.window.main.minHeight,
    maxWidth: APP_CONFIG.window.main.maxWidth,
    maxHeight: APP_CONFIG.window.main.maxHeight,
    resizable: false, // Запрещаем изменение размера
    maximizable: false, // Запрещаем развертывание на весь экран
    fullscreenable: false, // Отключаем полноэкранный режим (F11)
    frame: false,
    titleBarStyle: 'hidden',
    title: 'SafeKey',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      devTools: process.env.NODE_ENV === 'development', // Только в режиме разработки
    },
    show: false,
    backgroundColor: '#ffffff',
  });

  // Устанавливаем иконку для панели задач (Windows) и сохраняем её для трея
  if (iconPath && process.platform === 'win32') {
    try {
      if (fs.existsSync(iconPath)) {
        const icon = nativeImage.createFromPath(iconPath);
        if (!icon.isEmpty()) {
          mainWindow.setIcon(icon);
          appIcon = icon; // Сохраняем иконку для использования в трее
          console.log('[Main] Иконка установлена для главного окна:', iconPath);
        } else {
          console.warn('[Main] Иконка пустая:', iconPath);
        }
      } else {
        console.warn('[Main] Файл иконки не найден:', iconPath);
      }
    } catch (error) {
      console.error('[Main] Ошибка установки иконки:', error);
    }
  }

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    // DevTools отключены в production для обычных пользователей
  }

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[Main] Ошибка загрузки:', errorCode, errorDescription);
  });
  
  // Отключаем F11 (fullscreen) - перехватываем событие
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11') {
      event.preventDefault();
      // Ничего не делаем - просто блокируем F11
    }
  });

  // Горячая клавиша для открытия DevTools (F12) через globalShortcut - только в режиме разработки
  if (process.env.NODE_ENV === 'development') {
    app.whenReady().then(() => {
      try {
        const registeredF12 = globalShortcut.register('F12', () => {
          console.log('[Main] F12 нажата');
          if (mainWindow) {
            if (mainWindow.webContents.isDevToolsOpened()) {
              mainWindow.webContents.closeDevTools();
              console.log('[Main] DevTools закрыты через F12');
            } else {
              mainWindow.webContents.openDevTools();
              console.log('[Main] DevTools открыты через F12');
            }
          }
        });
        console.log('[Main] F12 зарегистрирована:', registeredF12);
        
        const registeredCtrlI = globalShortcut.register('CommandOrControl+Shift+I', () => {
          console.log('[Main] Ctrl+Shift+I нажата');
          if (mainWindow) {
            if (mainWindow.webContents.isDevToolsOpened()) {
              mainWindow.webContents.closeDevTools();
              console.log('[Main] DevTools закрыты через Ctrl+Shift+I');
            } else {
              mainWindow.webContents.openDevTools();
              console.log('[Main] DevTools открыты через Ctrl+Shift+I');
            }
          }
        });
        console.log('[Main] Ctrl+Shift+I зарегистрирована:', registeredCtrlI);
      } catch (error) {
        console.error('[Main] Ошибка регистрации горячих клавиш:', error);
      }
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      // Убеждаемся, что иконка установлена для панели задач
      if (iconPath && process.platform === 'win32') {
        try {
          if (fs.existsSync(iconPath)) {
            const icon = nativeImage.createFromPath(iconPath);
            if (!icon.isEmpty()) {
              mainWindow.setIcon(icon);
              appIcon = icon; // Сохраняем иконку для трея
              console.log('[Main] Иконка установлена в ready-to-show:', iconPath);
            }
          }
        } catch (error) {
          console.error('[Main] Ошибка установки иконки в ready-to-show:', error);
        }
      }
      
      const appSettings = loadAppSettings();
      if (appSettings.startMinimized) {
        // Не показываем окно, только создаем трей
        createTray();
      } else {
        mainWindow.show();
      }
      // DevTools отключены в production
      // Инициализируем автообновление после показа окна (включаем и в режиме разработки)
      initializeUpdater(mainWindow, overlayWindow, tray);
    }
  });

  // Обработка сворачивания в трей
  mainWindow.on('minimize', (event: Electron.Event) => {
    const appSettings = loadAppSettings();
    if (appSettings.minimizeToTray) {
      event.preventDefault();
      if (mainWindow) {
        mainWindow.hide();
        if (!tray) {
          createTray();
        }
      }
    }
  });

  mainWindow.on('close', (event) => {
    const appSettings = loadAppSettings();
    if (appSettings.minimizeToTray) {
      event.preventDefault();
      if (mainWindow) {
        mainWindow.hide();
        if (!tray) {
          createTray();
        }
      }
    }
  });
}

function createTray() {
  if (tray) return;

  // Сначала пробуем использовать сохраненную иконку приложения
  if (appIcon && !appIcon.isEmpty()) {
    try {
      const trayIcon = appIcon.resize({ width: 32, height: 32 });
      tray = new Tray(trayIcon);
      console.log('[Main] ✅ Трей создан с сохраненной иконкой приложения');
      setupTrayMenu();
      return;
    } catch (error) {
      console.warn('[Main] Ошибка использования сохраненной иконки:', error);
    }
  }

  // Путь к иконке для трея
  let iconPath: string;
  if (process.env.NODE_ENV === 'development') {
    iconPath = path.join(__dirname, '../../build/icon.ico');
  } else {
    const possiblePaths = [
      path.join(process.resourcesPath, 'build/icon.ico'),
      path.join(process.resourcesPath, 'app/build/icon.ico'),
      path.join(__dirname, '../build/icon.ico'),
      path.join(__dirname, '../../build/icon.ico'),
    ];
    iconPath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
  }

  // Загружаем иконку для трея
  try {
    console.log('[Main] Попытка загрузки иконки трея из:', iconPath);
    console.log('[Main] Файл существует:', fs.existsSync(iconPath));
    
    if (fs.existsSync(iconPath)) {
      const icon = nativeImage.createFromPath(iconPath);
      console.log('[Main] Иконка загружена, isEmpty:', icon.isEmpty(), 'размер:', icon.getSize());
      
      if (!icon.isEmpty()) {
        // Для Windows трей лучше работает с размером 32x32 или оригинальным размером
        // Пробуем несколько вариантов
        let trayIcon: Electron.NativeImage;
        
        const originalSize = icon.getSize();
        console.log('[Main] Оригинальный размер иконки:', originalSize);
        
        if (process.platform === 'win32') {
          // Для Windows используем размер 32x32 или оригинальный, если он меньше
          const targetSize = Math.min(32, Math.max(originalSize.width, originalSize.height));
          trayIcon = icon.resize({ width: targetSize, height: targetSize });
          // НЕ используем setTemplateImage(false) - это может мешать отображению
          console.log('[Main] Создан трей-иконка размером:', targetSize);
        } else {
          const traySize = 22;
          trayIcon = icon.resize({ width: traySize, height: traySize });
        }
        
        tray = new Tray(trayIcon);
        console.log('[Main] ✅ Трей создан успешно с иконкой из:', iconPath);
      } else {
        console.error('[Main] ❌ Иконка пустая после загрузки');
        // Пробуем использовать сохраненную иконку приложения
        if (appIcon && !appIcon.isEmpty()) {
          const trayIcon = appIcon.resize({ width: 32, height: 32 });
          tray = new Tray(trayIcon);
          console.log('[Main] ✅ Использована сохраненная иконка приложения для трея');
        } else {
          tray = new Tray(nativeImage.createEmpty());
        }
      }
    } else {
      console.error('[Main] ❌ Файл иконки не найден:', iconPath);
      // Пробуем альтернативные пути
      const altPaths = [
        path.join(__dirname, '../../build/icon.ico'),
        path.join(__dirname, '../../../build/icon.ico'),
        path.join(process.resourcesPath || '', 'build/icon.ico'),
      ];
      
      let found = false;
      for (const altPath of altPaths) {
        if (fs.existsSync(altPath)) {
          console.log('[Main] Найдена альтернативная иконка:', altPath);
          const icon = nativeImage.createFromPath(altPath);
          if (!icon.isEmpty()) {
            const trayIcon = icon.resize({ width: 32, height: 32 });
            tray = new Tray(trayIcon);
            found = true;
            console.log('[Main] ✅ Трей создан с альтернативной иконкой');
          }
          break;
        }
      }
      
      if (!found) {
        tray = new Tray(nativeImage.createEmpty());
        console.error('[Main] ❌ Не удалось найти иконку ни по одному пути');
      }
    }
  } catch (error) {
    console.error('[Main] ❌ Ошибка загрузки иконки для трея:', error);
    tray = new Tray(nativeImage.createEmpty());
  }

  setupTrayMenu();
}

function setupTrayMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Открыть SafeKey',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createMainWindow();
        }
      },
    },
    {
      label: 'Оверлей',
      click: () => {
        createOverlayWindow();
      },
    },
    { type: 'separator' },
    {
      label: 'Выход',
      click: () => {
        // Закрываем все окна перед выходом
        if (mainWindow) {
          mainWindow.destroy();
          mainWindow = null;
        }
        if (overlayWindow) {
          overlayWindow.destroy();
          overlayWindow = null;
        }
        // Уничтожаем трей
        if (tray) {
          tray.destroy();
          tray = null;
        }
        // Выходим из приложения
        app.quit();
      },
    },
  ]);

  tray.setToolTip('SafeKey');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createMainWindow();
    }
  });

  // Обновляем ссылку на tray в updater
  updateWindowReferences(mainWindow, overlayWindow, tray);
}

function setupAutoLaunch() {
  if (process.platform === 'win32') {
    autoLauncher = new AutoLaunch({
      name: 'SafeKey',
      path: app.getPath('exe'),
    });
  }
}

async function setAutoLaunch(enabled: boolean) {
  if (!autoLauncher) {
    setupAutoLaunch();
  }
  if (autoLauncher) {
    try {
      const isEnabled = await autoLauncher.isEnabled();
      if (enabled && !isEnabled) {
        await autoLauncher.enable();
      } else if (!enabled && isEnabled) {
        await autoLauncher.disable();
      }
    } catch (error) {
      console.error('[AutoLaunch] Ошибка:', error);
    }
  }
}

function createOverlayWindow() {
  if (overlayWindow) {
    overlayWindow.focus();
    return;
  }

  const displays = screen.getAllDisplays();
  const primaryDisplay = displays[0];

  overlayWindow = new BrowserWindow({
    width: APP_CONFIG.window.overlay.width,
    height: APP_CONFIG.window.overlay.height,
    x: Math.round((primaryDisplay.workAreaSize.width - 600) / 2),
    y: Math.round((primaryDisplay.workAreaSize.height - 500) / 4),
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      devTools: process.env.NODE_ENV === 'development', // Только в режиме разработки
    },
  });

  if (process.env.NODE_ENV === 'development') {
    overlayWindow.loadURL('http://localhost:5173/#/overlay');
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: 'overlay',
    });
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null;
    // Обновляем ссылку на overlayWindow в updater
    updateWindowReferences(mainWindow, overlayWindow, tray);
  });

  overlayWindow.on('blur', () => {
    if (overlayWindow) {
      overlayWindow.close();
    }
  });

  // Обновляем ссылку на overlayWindow в updater
  updateWindowReferences(mainWindow, overlayWindow, tray);
}

function registerOverlayShortcut() {
  // Отменяем предыдущую регистрацию
  globalShortcut.unregisterAll();
  
  // Загружаем настройки
  const appSettings = loadAppSettings();
  currentOverlayShortcut = appSettings.overlayShortcut || APP_CONFIG.shortcuts.overlay;
  
  // Регистрируем новую горячую клавишу
  const registered = globalShortcut.register(currentOverlayShortcut, () => {
    createOverlayWindow();
  });
  
  if (!registered) {
    console.error('[Main] Не удалось зарегистрировать горячую клавишу:', currentOverlayShortcut);
  } else {
    console.log('[Main] Горячая клавиша зарегистрирована:', currentOverlayShortcut);
  }
}

app.whenReady().then(() => {
  // Проверяем настройки - открывать ли в оверлее
  const appSettings = loadAppSettings();
  
  if (appSettings.openInOverlay) {
    createOverlayWindow();
  } else {
    createMainWindow();
  }

  // Регистрация глобальной горячей клавиши для оверлея
  registerOverlayShortcut();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const settings = loadAppSettings();
      if (settings.openInOverlay) {
        createOverlayWindow();
      } else {
        createMainWindow();
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// IPC обработчики для работы с базой данных
let dbService: DatabaseService | null = null;
let encryptionService: EncryptionService | null = null;
let windowsPinAuthService: WindowsPinAuthService | null = null;

// Вспомогательная функция для инициализации шифрования
async function ensureEncryptionInitialized(): Promise<void> {
  if (!encryptionService) {
    encryptionService = new EncryptionService();
  }
  
  // Автоматически инициализируем шифрование при первом использовании
  if (!encryptionService.isInitialized()) {
    const username = os.userInfo().username;
    await encryptionService.setMasterPassword(username + '-safekey-default-key');
  } else if (!encryptionService.masterKey) {
    // Если файл существует, но ключ не загружен в память, восстанавливаем его
    const username = os.userInfo().username;
    const restored = await encryptionService.restoreMasterKey(username + '-safekey-default-key');
    if (!restored) {
      // Если не удалось восстановить, пересоздаем ключ
      await encryptionService.setMasterPassword(username + '-safekey-default-key');
    }
  }
}

ipcMain.handle('init-database', async (_, dbPath: string) => {
  if (!dbService) {
    dbService = new DatabaseService(dbPath);
    await dbService.initialize();
  }
  return { success: true };
});

// Обработчики для проверки PIN-кода Windows
ipcMain.handle('verify-windows-pin', async () => {
  try {
    console.log('[Main] verify-windows-pin вызван');
    if (!windowsPinAuthService) {
      windowsPinAuthService = new WindowsPinAuthService();
    }
    const result = await windowsPinAuthService.verifyPinCode();
    console.log('[Main] Результат проверки PIN-кода:', result);
    return result;
  } catch (error) {
    console.error('[Main] Ошибка проверки PIN-кода:', error);
    return false;
  }
});

ipcMain.handle('check-windows-pin-available', async () => {
  try {
    if (!windowsPinAuthService) {
      windowsPinAuthService = new WindowsPinAuthService();
    }
    const available = await windowsPinAuthService.checkPinCodeAvailable();
    console.log('[Main] PIN-код доступен:', available);
    return available;
  } catch (error) {
    console.error('[Main] Ошибка проверки доступности PIN-кода:', error);
    return false;
  }
});

// Инициализация encryptionService для работы с данными
// Мастер-ключ теперь генерируется автоматически при первом использовании
ipcMain.handle('init-encryption', async () => {
  try {
    if (!encryptionService) {
      encryptionService = new EncryptionService();
    }
    // Если мастер-ключ еще не установлен, создаем его на основе имени пользователя Windows
    if (!encryptionService.isInitialized()) {
      const username = os.userInfo().username;
      // Используем имя пользователя как основу для мастер-ключа
      // В реальности это должно быть более безопасно
      await encryptionService.setMasterPassword(username + '-safekey-default-key');
      console.log('[Main] Мастер-ключ инициализирован автоматически');
    }
    return { success: true };
  } catch (error) {
    console.error('[Main] Ошибка инициализации шифрования:', error);
    throw error;
  }
});

ipcMain.handle('create-password-entry', async (_, entry: any) => {
  if (!dbService) {
    throw new Error('Database not initialized');
  }
  await ensureEncryptionInitialized();
  const encrypted = encryptionService!.encrypt(JSON.stringify(entry.data));
  return dbService.createPasswordEntry(encrypted, entry.title || 'Без названия', entry.category_id);
});

ipcMain.handle('get-password-entries', async () => {
  if (!dbService) {
    throw new Error('Database not initialized');
  }
  await ensureEncryptionInitialized();
  const entries = await dbService.getAllPasswordEntries();
  const encService = encryptionService!; // Для TypeScript
  return entries.map((entry) => {
    try {
      const decrypted = encService.decrypt(entry.encrypted_data);
      // Проверяем, что расшифрованные данные не пустые
      if (!decrypted || decrypted.trim() === '') {
        console.warn('[Main] Пустые данные для записи:', entry.id);
        return {
          ...entry,
          data: { service: '', login: '', password: '', url: '', notes: '' },
        };
      }
      return {
        ...entry,
        data: JSON.parse(decrypted),
      };
    } catch (error) {
      console.error('[Main] Ошибка расшифровки записи:', entry.id, error);
      // Возвращаем запись с пустыми данными вместо ошибки
      return {
        ...entry,
        data: { service: '', login: '', password: '', url: '', notes: '' },
      };
    }
  });
});

ipcMain.handle('update-password-entry', async (_, id: number, entry: any) => {
  if (!dbService) {
    throw new Error('Database not initialized');
  }
  await ensureEncryptionInitialized();
  const encrypted = encryptionService!.encrypt(JSON.stringify(entry.data));
  return dbService.updatePasswordEntry(id, encrypted, entry.title, entry.category_id);
});

ipcMain.handle('delete-password-entry', async (_, id: number) => {
  if (!dbService) {
    throw new Error('Database not initialized');
  }
  return dbService.deletePasswordEntry(id);
});

ipcMain.handle('search-passwords', async (_, query: string) => {
  if (!dbService) {
    throw new Error('Database not initialized');
  }
  await ensureEncryptionInitialized();
  const entries = await dbService.searchPasswordEntries(query);
  const encService = encryptionService!; // Для TypeScript
  return entries.map((entry) => {
    try {
      const decrypted = encService.decrypt(entry.encrypted_data);
      if (!decrypted || decrypted.trim() === '') {
        console.warn('[Main] Пустые данные для записи:', entry.id);
        return {
          ...entry,
          data: { service: '', login: '', password: '', url: '', notes: '' },
        };
      }
      return {
        ...entry,
        data: JSON.parse(decrypted),
      };
    } catch (error) {
      console.error('[Main] Ошибка расшифровки записи:', entry.id, error);
      return {
        ...entry,
        data: { service: '', login: '', password: '', url: '', notes: '' },
      };
    }
  });
});

// Избранное
ipcMain.handle('toggle-favorite', async (_, id: number) => {
  if (!dbService) {
    throw new Error('Database not initialized');
  }
  await ensureEncryptionInitialized();
  const entry = dbService.toggleFavorite(id);
  if (!entry) return null;
  const encService = encryptionService!;
  try {
    const decrypted = encService.decrypt(entry.encrypted_data);
    if (!decrypted || decrypted.trim() === '') {
      console.warn('[Main] Пустые данные для записи:', entry.id);
      return {
        ...entry,
        data: { service: '', login: '', password: '', url: '', notes: '' },
      };
    }
    return {
      ...entry,
      data: JSON.parse(decrypted),
    };
  } catch (error) {
    console.error('[Main] Ошибка расшифровки записи:', entry.id, error);
    return {
      ...entry,
      data: { service: '', login: '', password: '', url: '', notes: '' },
    };
  }
});

ipcMain.handle('get-favorite-passwords', async () => {
  if (!dbService) {
    throw new Error('Database not initialized');
  }
  await ensureEncryptionInitialized();
  const entries = dbService.getFavoritePasswordEntries();
  const encService = encryptionService!;
  return entries.map((entry) => {
    try {
      const decrypted = encService.decrypt(entry.encrypted_data);
      if (!decrypted || decrypted.trim() === '') {
        console.warn('[Main] Пустые данные для записи:', entry.id);
        return {
          ...entry,
          data: { service: '', login: '', password: '', url: '', notes: '' },
        };
      }
      return {
        ...entry,
        data: JSON.parse(decrypted),
      };
    } catch (error) {
      console.error('[Main] Ошибка расшифровки записи:', entry.id, error);
      return {
        ...entry,
        data: { service: '', login: '', password: '', url: '', notes: '' },
      };
    }
  });
});

// Категории (Раскладки)
ipcMain.handle('create-category', async (_, name: string, parentId?: number | null) => {
  if (!dbService) {
    throw new Error('Database not initialized');
  }
  return dbService.createCategory(name, parentId);
});

ipcMain.handle('get-categories', async () => {
  if (!dbService) {
    throw new Error('Database not initialized');
  }
  return dbService.getAllCategories();
});

ipcMain.handle('update-category', async (_, id: number, name: string) => {
  if (!dbService) {
    throw new Error('Database not initialized');
  }
  return dbService.updateCategory(id, name);
});

ipcMain.handle('delete-category', async (_, id: number) => {
  if (!dbService) {
    throw new Error('Database not initialized');
  }
  return dbService.deleteCategory(id);
});

// Backup Codes IPC handlers
ipcMain.handle('create-backup-code-entry', async (_, entry: any) => {
  if (!dbService) {
    throw new Error('Database not initialized');
  }
  await ensureEncryptionInitialized();
  const codes = entry.codes.map((code: string) => ({ code, used: false }));
  const data = { title: entry.title, codes };
  const encrypted = encryptionService!.encrypt(JSON.stringify(data));
  return dbService.createBackupCodeEntry(encrypted, entry.title);
});

ipcMain.handle('get-backup-code-entries', async () => {
  if (!dbService) {
    throw new Error('Database not initialized');
  }
  await ensureEncryptionInitialized();
  const entries = await dbService.getAllBackupCodeEntries();
  return entries;
});

ipcMain.handle('get-backup-code-entry-by-id', async (_, id: number) => {
  if (!dbService) {
    throw new Error('Database not initialized');
  }
  return dbService.getBackupCodeEntryById(id);
});

ipcMain.handle('update-backup-code-entry', async (_, id: number, entry: any) => {
  if (!dbService) {
    throw new Error('Database not initialized');
  }
  await ensureEncryptionInitialized();
  const existing = dbService.getBackupCodeEntryById(id);
  if (!existing) {
    throw new Error('Entry not found');
  }
  
  // Расшифровываем существующие данные
  const decrypted = encryptionService!.decrypt(existing.encrypted_data);
  const existingData = JSON.parse(decrypted);
  
  // Обновляем данные
  if (entry.title !== undefined) {
    existingData.title = entry.title;
  }
  if (entry.codes !== undefined) {
    existingData.codes = entry.codes;
  }
  
  const encrypted = encryptionService!.encrypt(JSON.stringify(existingData));
  return dbService.updateBackupCodeEntry(id, encrypted, entry.title);
});

ipcMain.handle('delete-backup-code-entry', async (_, id: number) => {
  if (!dbService) {
    throw new Error('Database not initialized');
  }
  return dbService.deleteBackupCodeEntry(id);
});

ipcMain.handle('decrypt-backup-code-entry', async (_, entry: any) => {
  if (!encryptionService) {
    await ensureEncryptionInitialized();
  }
  try {
    const decrypted = encryptionService!.decrypt(entry.encrypted_data);
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('[Main] Ошибка расшифровки резервного кода:', error);
    throw error;
  }
});

// Security Questions IPC handlers
ipcMain.handle('create-security-question-entry', async (_, entry: any) => {
  if (!dbService) {
    throw new Error('Database not initialized');
  }
  await ensureEncryptionInitialized();
  const data = { title: entry.title, questions: entry.questions };
  const encrypted = encryptionService!.encrypt(JSON.stringify(data));
  return dbService.createSecurityQuestion(encrypted, entry.title);
});

ipcMain.handle('get-security-question-entries', async () => {
  if (!dbService) {
    throw new Error('Database not initialized');
  }
  await ensureEncryptionInitialized();
  const entries = await dbService.getAllSecurityQuestions();
  return entries;
});

ipcMain.handle('get-security-question-entry-by-id', async (_, id: number) => {
  if (!dbService) {
    throw new Error('Database not initialized');
  }
  return dbService.getSecurityQuestionById(id);
});

ipcMain.handle('update-security-question-entry', async (_, id: number, entry: any) => {
  if (!dbService) {
    throw new Error('Database not initialized');
  }
  await ensureEncryptionInitialized();
  const existing = dbService.getSecurityQuestionById(id);
  if (!existing) {
    throw new Error('Entry not found');
  }
  
  // Расшифровываем существующие данные
  const decrypted = encryptionService!.decrypt(existing.encrypted_data);
  const existingData = JSON.parse(decrypted);
  
  // Обновляем данные
  if (entry.title !== undefined) {
    existingData.title = entry.title;
  }
  if (entry.questions !== undefined) {
    existingData.questions = entry.questions;
  }
  
  const encrypted = encryptionService!.encrypt(JSON.stringify(existingData));
  return dbService.updateSecurityQuestion(id, encrypted, entry.title);
});

ipcMain.handle('delete-security-question-entry', async (_, id: number) => {
  if (!dbService) {
    throw new Error('Database not initialized');
  }
  return dbService.deleteSecurityQuestion(id);
});

ipcMain.handle('decrypt-security-question-entry', async (_, entry: any) => {
  if (!encryptionService) {
    await ensureEncryptionInitialized();
  }
  try {
    const decrypted = encryptionService!.decrypt(entry.encrypted_data);
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('[Main] Ошибка расшифровки контрольного вопроса:', error);
    throw error;
  }
});

ipcMain.handle('get-passwords-by-category', async (_, categoryId: number | null) => {
  if (!dbService) {
    throw new Error('Database not initialized');
  }
  await ensureEncryptionInitialized();
  const entries = dbService.getPasswordEntriesByCategory(categoryId);
  const encService = encryptionService!;
  return entries.map((entry) => {
    try {
      const decrypted = encService.decrypt(entry.encrypted_data);
      if (!decrypted || decrypted.trim() === '') {
        console.warn('[Main] Пустые данные для записи:', entry.id);
        return {
          ...entry,
          data: { service: '', login: '', password: '', url: '', notes: '' },
        };
      }
      return {
        ...entry,
        data: JSON.parse(decrypted),
      };
    } catch (error) {
      console.error('[Main] Ошибка расшифровки записи:', entry.id, error);
      return {
        ...entry,
        data: { service: '', login: '', password: '', url: '', notes: '' },
      };
    }
  });
});

// Облачные настройки
ipcMain.handle('get-cloud-settings', async () => {
  try {
    return loadCloudSettings();
  } catch (error) {
    console.error('[Main] Ошибка загрузки облачных настроек:', error);
    return {
      yandexDisk: { enabled: false, token: '', path: '' },
      googleDrive: { enabled: false, token: '', folderId: '' },
    };
  }
});

ipcMain.handle('save-cloud-settings', async (_, settings: any) => {
  try {
    saveCloudSettings(settings);
    console.log('[Main] Облачные настройки сохранены:', settings);
    return { success: true };
  } catch (error) {
    console.error('[Main] Ошибка сохранения облачных настроек:', error);
    throw error;
  }
});

ipcMain.handle('authorize-yandex-disk', async () => {
  try {
    console.log('[Main] Запуск авторизации Яндекс.Диска...');
    const token = await YandexOAuthService.authorize();
    if (token) {
      console.log('[Main] Токен получен успешно');
      // Сохраняем токен в настройках
      const cloudSettings = loadCloudSettings();
      cloudSettings.yandexDisk = {
        ...cloudSettings.yandexDisk,
        enabled: true,
        token: token,
      };
      saveCloudSettings(cloudSettings);
      return { success: true, token };
    } else {
      console.log('[Main] Авторизация отменена или не удалась');
      return { success: false, token: null };
    }
  } catch (error) {
    console.error('[Main] Ошибка авторизации Яндекс.Диска:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Неизвестная ошибка' };
  }
});

ipcMain.handle('authorize-google-drive', async () => {
  try {
    console.log('[Main] Запуск авторизации Google Drive...');
    const token = await GoogleOAuthService.authorize();
    if (token) {
      console.log('[Main] Токен Google Drive получен успешно');
      // Сохраняем токен в настройках
      const cloudSettings = loadCloudSettings();
      cloudSettings.googleDrive = {
        ...cloudSettings.googleDrive,
        enabled: true,
        token: token,
      };
      saveCloudSettings(cloudSettings);
      return { success: true, token };
    } else {
      console.log('[Main] Авторизация Google Drive отменена или не удалась');
      return { success: false, token: null };
    }
  } catch (error) {
    console.error('[Main] Ошибка авторизации Google Drive:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Неизвестная ошибка' };
  }
});

ipcMain.handle('sync-to-cloud', async () => {
  try {
    if (!dbService) {
      throw new Error('Database not initialized');
    }

    const cloudSettings = loadCloudSettings();
    const dbPath = PATHS.database();
    
    if (!fs.existsSync(dbPath)) {
      console.error('[CloudSync] База данных не найдена:', dbPath);
      return { success: false, error: 'База данных не найдена' };
    }

    let success = false;
    let errorMessage = '';

    // Синхронизация с Яндекс.Диском
    if (cloudSettings.yandexDisk?.enabled && cloudSettings.yandexDisk.token) {
      try {
        // Нормализуем путь - убираем начальный слэш если есть
        let diskPath = (cloudSettings.yandexDisk.path || 'SafeKey').trim();
        if (diskPath.startsWith('/')) {
          diskPath = diskPath.substring(1);
        }
        const yandexDisk = new YandexDiskService(
          cloudSettings.yandexDisk.token,
          diskPath
        );
        
        // Шифруем базу данных перед загрузкой
        await ensureEncryptionInitialized();
        const tempDbPath = path.join(app.getPath('temp'), 'safekey_backup.db');
        const tempEncryptedPath = path.join(app.getPath('temp'), 'safekey_backup_encrypted.dat');
        
        // Шифруем базу данных
        encryptionService!.encryptFile(dbPath, tempEncryptedPath);
        
        // Используем фиксированное имя файла вместо временной метки
        const fileName = 'safekey_backup.dat';
        
        // Получаем список существующих файлов резервных копий
        const existingFiles = await yandexDisk.listFiles();
        const backupFiles = existingFiles.filter(f => 
          f.startsWith('safekey_backup') && (f.endsWith('.dat') || f.endsWith('.db'))
        );
        
        // Загружаем новый файл (он перезапишет существующий с таким же именем)
        success = await yandexDisk.uploadFile(tempEncryptedPath, fileName);
        
        // Удаляем временные файлы
        if (fs.existsSync(tempDbPath)) {
          fs.unlinkSync(tempDbPath);
        }
        if (fs.existsSync(tempEncryptedPath)) {
          fs.unlinkSync(tempEncryptedPath);
        }

        if (success) {
          console.log('[CloudSync] База данных успешно загружена на Яндекс.Диск');
          
          // Удаляем все старые файлы резервных копий, кроме текущего
          let deletedCount = 0;
          for (const oldFile of backupFiles) {
            if (oldFile !== fileName) {
              const deleted = await yandexDisk.deleteFile(oldFile);
              if (deleted) {
                deletedCount++;
                console.log(`[CloudSync] Удален старый файл резервной копии: ${oldFile}`);
              }
            }
          }
          
          if (deletedCount > 0) {
            console.log(`[CloudSync] Удалено старых файлов резервных копий: ${deletedCount}`);
          }
          
          // Проверяем, что файл действительно загружен
          const exists = await yandexDisk.fileExists(fileName);
          if (!exists) {
            console.warn('[CloudSync] Файл загружен, но не найден при проверке');
          }
        } else {
          errorMessage = 'Ошибка загрузки на Яндекс.Диск';
          console.error('[CloudSync]', errorMessage);
        }
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
        console.error('[CloudSync] Ошибка синхронизации с Яндекс.Диском:', error);
      }
    }

    // TODO: Синхронизация с Google Drive

    return { success, error: errorMessage || undefined };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
    console.error('[CloudSync] Ошибка синхронизации с облаком:', error);
    return { success: false, error: errorMessage };
  }
});

ipcMain.handle('get-windows-username', async () => {
  try {
    const username = os.userInfo().username;
    return username;
  } catch (error) {
    console.error('[Main] Ошибка получения имени пользователя:', error);
    return 'Пользователь';
  }
});

ipcMain.handle('check-cloud-sync', async () => {
  try {
    const cloudSettings = loadCloudSettings();
    
    if (!cloudSettings.yandexDisk?.enabled || !cloudSettings.yandexDisk.token) {
      return { synced: false, message: 'Синхронизация с Яндекс.Диском не настроена' };
    }

    // Нормализуем путь - убираем начальный слэш если есть
    let diskPath = (cloudSettings.yandexDisk.path || 'SafeKey').trim();
    if (diskPath.startsWith('/')) {
      diskPath = diskPath.substring(1);
    }
    const yandexDisk = new YandexDiskService(
      cloudSettings.yandexDisk.token,
      diskPath
    );

    const files = await yandexDisk.listFiles();
    const backupFiles = files.filter(f => 
      f.startsWith('safekey_backup') && (f.endsWith('.dat') || f.endsWith('.db'))
    );
    
    if (backupFiles.length > 0) {
      // Проверяем наличие основного файла
      const mainBackupFile = backupFiles.find(f => f === 'safekey_backup.dat');
      if (mainBackupFile) {
        return { 
          synced: true, 
          message: `Синхронизировано: ${mainBackupFile}`,
          files: backupFiles 
        };
      } else {
        // Если есть только старые файлы с временными метками
        backupFiles.sort().reverse();
        const latestFile = backupFiles[0];
        return { 
          synced: true, 
          message: `Найдена старая резервная копия: ${latestFile}`,
          files: backupFiles 
        };
      }
    } else {
      return { synced: false, message: 'Файлы резервных копий не найдены на Яндекс.Диске' };
    }
  } catch (error) {
    console.error('[CloudSync] Ошибка проверки синхронизации:', error);
    return { 
      synced: false, 
      message: 'Ошибка проверки: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
    };
  }
});

// Обработчики управления окном
ipcMain.handle('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window-close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

// Автообновление
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

// App Settings
ipcMain.handle('get-app-settings', async () => {
  try {
    return loadAppSettings();
  } catch (error) {
    console.error('[Main] Ошибка загрузки настроек приложения:', error);
    return {
      overlayShortcut: APP_CONFIG.shortcuts.overlay,
      openInOverlay: false,
    };
  }
});

// Get App Version
ipcMain.handle('get-app-version', async () => {
  return appVersion;
});

ipcMain.handle('save-app-settings', async (_, settings: any) => {
  try {
    const oldSettings = loadAppSettings();
    saveAppSettings(settings);
    
    // Перерегистрируем горячую клавишу
    registerOverlayShortcut();
    
    // Обновляем автозапуск если изменился
    if (settings.autoStart !== oldSettings.autoStart) {
      await setAutoLaunch(settings.autoStart || false);
    }
    
    // Обновляем трей если нужно
    if (settings.minimizeToTray && !tray) {
      createTray();
    } else if (!settings.minimizeToTray && tray) {
      tray.destroy();
      tray = null;
      // Обновляем ссылку на tray в updater
      updateWindowReferences(mainWindow, overlayWindow, tray);
    }
    
    return { success: true };
  } catch (error) {
    console.error('[Main] Ошибка сохранения настроек приложения:', error);
    throw error;
  }
});

// Overlay
ipcMain.handle('open-overlay', async () => {
  createOverlayWindow();
});

// Clipboard
ipcMain.handle('copy-to-clipboard', async (_, text: string) => {
  clipboard.writeText(text);
  return { success: true };
});

// URL
ipcMain.handle('open-url', async (_, url: string) => {
  await shell.openExternal(url);
  return { success: true };
});

