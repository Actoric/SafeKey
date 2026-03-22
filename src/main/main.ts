import { app, BrowserWindow, globalShortcut, ipcMain, screen, shell, Tray, Menu, nativeImage, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
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
import { AppPinAuthService } from './auth/app-pin-auth';
import { initializeUpdater, checkForUpdates, downloadUpdate, installUpdate, updateWindowReferences } from './updater/github-updater';
import { clipboard } from 'electron';
import AutoLaunch from 'auto-launch';
import { showCloseDialog, setMainWindowRef as setCloseDialogMainWindow } from './dialogs/close-dialog';
import { showDeleteCategoryDialog, setMainWindowRef as setDeleteCategoryMainWindow } from './dialogs/delete-category-dialog';
import { showDeleteSecurityQuestionDialog, setMainWindowRef as setDeleteSecurityQuestionMainWindow } from './dialogs/delete-security-question-dialog';
import { showDeleteBackupCodeDialog, setMainWindowRef as setDeleteBackupCodeMainWindow } from './dialogs/delete-backup-code-dialog';

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let appIcon: Electron.NativeImage | null = null; // Сохраняем иконку приложения
let currentOverlayShortcut: string = APP_CONFIG.shortcuts.overlay;
let autoLauncher: AutoLaunch | null = null;
let isUserAuthenticated: boolean = false; // Состояние авторизации пользователя

function createMainWindow() {
  // Проверяем, не создано ли уже окно
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('[Main] Окно уже существует, фокусируем его');
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  // Путь к иконке приложения
  let iconPath: string | undefined;
  if (process.env.NODE_ENV === 'development') {
    const devIconPath = path.join(__dirname, '../../build/icon.ico');
    if (fs.existsSync(devIconPath)) {
      iconPath = devIconPath;
    }
  } else {
    // В production используем иконку из exe файла (встроенную electron-builder)
    // Сначала пробуем использовать сам exe файл как источник иконки
    if (process.platform === 'win32') {
      const exePath = process.execPath;
      if (fs.existsSync(exePath)) {
        iconPath = exePath; // Используем exe файл, в котором встроена иконка
      }
    }
    
    // Если не удалось использовать exe, пробуем другие пути
    if (!iconPath) {
      const possiblePaths = [
        path.join(process.resourcesPath, 'build/icon.ico'),
        path.join(process.resourcesPath, 'app/build/icon.ico'),
        path.join(__dirname, '../build/icon.ico'),
        path.join(app.getAppPath(), 'build/icon.ico'),
        path.join(process.execPath, '../build/icon.ico'),
        path.join(process.execPath, '../../build/icon.ico'),
      ];
      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          iconPath = possiblePath;
          break;
        }
      }
    }
  }

  // В production иконка уже встроена в exe файл через electron-builder
  // Иконка передается в BrowserWindow через параметр icon выше
  // НЕ устанавливаем иконку программно в production, чтобы не перезаписать встроенную

  // Цвет фона окна по сохранённой теме — без моргания при загрузке
  const initialSettings = loadAppSettings();
  const windowBgColor = initialSettings.theme === 'dark' ? '#1F2937' : '#ffffff';

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
    backgroundColor: windowBgColor,
  });

  // В production иконка уже встроена в exe файл через electron-builder
  // Иконка устанавливается автоматически через параметр icon в BrowserWindow
  // НЕ переустанавливаем иконку программно, чтобы не перезаписать встроенную
  // Только сохраняем иконку для трея, если она еще не сохранена
  if (!appIcon && iconPath && process.env.NODE_ENV !== 'production') {
    // В development режиме можем установить иконку программно
    try {
      if (fs.existsSync(iconPath)) {
        const icon = nativeImage.createFromPath(iconPath);
        if (!icon.isEmpty()) {
          if (process.platform === 'win32') {
            mainWindow.setIcon(icon);
            console.log('[Main] Иконка установлена из (dev mode):', iconPath);
          }
          // Сохраняем иконку для использования в трее
          try {
            const icon16 = icon.resize({ width: 16, height: 16 });
            if (!icon16.isEmpty()) {
              appIcon = icon16;
              console.log('[Main] Иконка 16x16 сохранена в appIcon для трея');
            } else {
              appIcon = icon;
            }
          } catch (e) {
            appIcon = icon;
          }
        }
      }
    } catch (error) {
      console.error('[Main] Ошибка установки иконки (dev mode):', error);
    }
  } else if (process.env.NODE_ENV === 'production') {
    // В production только сохраняем иконку для трея из exe файла
    if (!appIcon && process.platform === 'win32') {
      try {
        const exePath = process.execPath;
        if (fs.existsSync(exePath)) {
          const icon = nativeImage.createFromPath(exePath);
          if (!icon.isEmpty()) {
            try {
              const icon16 = icon.resize({ width: 16, height: 16 });
              if (!icon16.isEmpty()) {
                appIcon = icon16;
                console.log('[Main] Иконка 16x16 сохранена из exe для трея');
              } else {
                appIcon = icon;
              }
            } catch (e) {
              appIcon = icon;
            }
          }
        }
      } catch (error) {
        console.error('[Main] Ошибка сохранения иконки из exe для трея:', error);
      }
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
      // Сохраняем ссылку на главное окно для диалогов
      setCloseDialogMainWindow(mainWindow);
      setDeleteCategoryMainWindow(mainWindow);
      setDeleteSecurityQuestionMainWindow(mainWindow);
      setDeleteBackupCodeMainWindow(mainWindow);
      
      // В production иконка уже встроена в exe файл через electron-builder
      // НЕ переустанавливаем иконку программно, чтобы не перезаписать встроенную
      // Иконка уже установлена при создании окна через параметр icon в BrowserWindow
      // Только сохраняем иконку для трея, если она еще не сохранена
      if (!appIcon && iconPath) {
        try {
          const exePath = process.platform === 'win32' ? process.execPath : iconPath;
          if (fs.existsSync(exePath)) {
            const icon = nativeImage.createFromPath(exePath);
            if (!icon.isEmpty()) {
              try {
                const icon16 = icon.resize({ width: 16, height: 16 });
                if (!icon16.isEmpty()) {
                  appIcon = icon16;
                  console.log('[Main] Иконка 16x16 сохранена в appIcon для трея');
                } else {
                  appIcon = icon;
                }
              } catch (e) {
                appIcon = icon;
              }
            }
          }
        } catch (error) {
          console.error('[Main] Ошибка сохранения иконки для трея:', error);
        }
      }
      
      // Проверяем настройки и применяем тему ДО показа окна — убираем моргание темы
      const appSettings = loadAppSettings();
      const theme = appSettings.theme || 'light';
      mainWindow.webContents.executeJavaScript(
        `document.documentElement.setAttribute('data-theme', ${JSON.stringify(theme)});`
      ).then(() => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        if (appSettings.autoStart) {
          console.log('[Main] Автозапуск включен, сворачиваем в трей');
          if (!tray) createTray();
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
        initializeUpdater(mainWindow, overlayWindow, tray);
      }).catch((err: unknown) => {
        console.error('[Main] Ошибка применения темы:', err);
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (appSettings.autoStart) {
            if (!tray) createTray();
            mainWindow.hide();
          } else {
            mainWindow.show();
            mainWindow.focus();
          }
          initializeUpdater(mainWindow, overlayWindow, tray);
        }
      });
    }
  });
  
  mainWindow.on('closed', () => {
    // Очищаем ссылки при закрытии окна
    setCloseDialogMainWindow(null);
    setDeleteCategoryMainWindow(null);
    setDeleteSecurityQuestionMainWindow(null);
  });

  mainWindow.on('close', async (event) => {
    const appSettings = loadAppSettings();
    
    // Если автозапуск включен, всегда сворачиваем в трей
    if (appSettings.autoStart) {
      event.preventDefault();
      if (mainWindow) {
        mainWindow.hide();
        if (!tray) {
          createTray();
        }
      }
      return;
    }

    // Если настройка выключена, спрашиваем пользователя через кастомный диалог
    event.preventDefault();
    
    const choice = await showCloseDialog();

    if (choice === 'minimize') {
      // Свернуть в трей
      if (mainWindow) {
        mainWindow.hide();
        if (!tray) {
          createTray();
        }
      }
    } else {
      // Закрыть приложение
      if (mainWindow) {
        mainWindow.destroy();
        mainWindow = null;
      }
      if (overlayWindow) {
        overlayWindow.destroy();
        overlayWindow = null;
      }
      if (tray) {
        tray.destroy();
        tray = null;
      }
      app.quit();
    }
  });
}

function createTray() {
  // Проверяем, не создан ли уже трей
  if (tray) {
    console.log('[Main] Трей уже существует, пропускаем создание');
    return;
  }
  
  console.log('[Main] Создаем новый трей');

  // Путь к специальной иконке для трея (PNG 16x16)
  let trayIconPath: string | null = null;
  if (process.env.NODE_ENV === 'development') {
    trayIconPath = path.join(__dirname, '../../build/tray-icon.png');
    console.log('[Main] Development: ищем tray-icon.png по пути:', trayIconPath);
    console.log('[Main] Файл существует:', fs.existsSync(trayIconPath));
  } else {
    const possiblePaths = [
      path.join(process.resourcesPath || '', 'build/tray-icon.png'),
      path.join(process.resourcesPath || '', 'app/build/tray-icon.png'),
      path.join(__dirname, '../build/tray-icon.png'),
      path.join(__dirname, '../../build/tray-icon.png'),
      path.join(app.getAppPath(), 'build/tray-icon.png'),
    ];
    console.log('[Main] Production: проверяем пути для tray-icon.png:');
    console.log('[Main] process.resourcesPath:', process.resourcesPath);
    console.log('[Main] __dirname:', __dirname);
    console.log('[Main] app.getAppPath():', app.getAppPath());
    for (const p of possiblePaths) {
      console.log('[Main] Проверяем путь:', p, 'существует:', fs.existsSync(p));
    }
    trayIconPath = possiblePaths.find(p => fs.existsSync(p)) || null;
    console.log('[Main] Выбранный путь tray-icon.png:', trayIconPath);
  }

  // Загружаем иконку для трея
  let trayIcon: Electron.NativeImage | null = null;
  
  try {
    // Приоритет 1: Используем специальный PNG файл для трея (16x16)
    if (trayIconPath && fs.existsSync(trayIconPath)) {
      console.log('[Main] ✅ Загружаем специальную иконку для трея:', trayIconPath);
      console.log('[Main] Размер файла:', fs.statSync(trayIconPath).size, 'байт');
      try {
        const icon = nativeImage.createFromPath(trayIconPath);
        const isEmpty = icon.isEmpty();
        const iconSize = icon.getSize();
        console.log('[Main] Иконка загружена из tray-icon.png');
        console.log('[Main] isEmpty:', isEmpty);
        console.log('[Main] Размер:', iconSize);
        
        if (!isEmpty) {
          // PNG уже должен быть 16x16, но проверим
          if (process.platform === 'win32') {
            if (iconSize.width === 16 && iconSize.height === 16) {
              trayIcon = icon;
              console.log('[Main] ✅ Используем PNG иконку 16x16 для трея (точный размер)');
            } else {
              // Если размер не 16x16, изменяем
              try {
                trayIcon = icon.resize({ width: 16, height: 16 });
                const resizedSize = trayIcon.getSize();
                console.log('[Main] ✅ Иконка изменена до 16x16, новый размер:', resizedSize);
              } catch (resizeError) {
                console.error('[Main] Ошибка изменения размера иконки:', resizeError);
                trayIcon = icon; // Используем оригинал
              }
            }
          } else {
            trayIcon = icon.resize({ width: 22, height: 22 });
          }
        } else {
          console.error('[Main] ❌ Иконка tray-icon.png пустая после загрузки');
        }
      } catch (e) {
        console.error('[Main] ❌ Ошибка загрузки tray-icon.png:', e);
        if (e instanceof Error) {
          console.error('[Main] Сообщение об ошибке:', e.message);
          console.error('[Main] Стек ошибки:', e.stack);
        }
      }
    } else {
      console.error('[Main] ❌ Файл tray-icon.png не найден по пути:', trayIconPath);
      console.error('[Main] Проверяем существование файла:', trayIconPath ? fs.existsSync(trayIconPath) : 'путь null');
    }
    
    // Приоритет 2: Если специальной иконки нет, используем сохраненную иконку приложения
    if (!trayIcon || trayIcon.isEmpty()) {
      if (appIcon && !appIcon.isEmpty()) {
        console.log('[Main] Используем сохраненную иконку приложения для трея');
        const iconSize = appIcon.getSize();
        console.log('[Main] Размер сохраненной иконки:', iconSize);
        
        if (process.platform === 'win32') {
          if (iconSize.width === 16 && iconSize.height === 16) {
            trayIcon = appIcon;
          } else {
            try {
              trayIcon = appIcon.resize({ width: 16, height: 16 });
              console.log('[Main] Иконка изменена до 16x16 для трея');
            } catch (e) {
              console.warn('[Main] Не удалось изменить размер иконки, используем оригинал');
              trayIcon = appIcon;
            }
          }
        } else {
          trayIcon = appIcon.resize({ width: 22, height: 22 });
        }
      }
    }
    
    // Приоритет 3: Пробуем загрузить из основного icon.ico файла
    if (!trayIcon || trayIcon.isEmpty()) {
      console.log('[Main] Пробуем загрузить из icon.ico');
      let iconIcoPath: string | null = null;
      if (process.env.NODE_ENV === 'development') {
        iconIcoPath = path.join(__dirname, '../../build/icon.ico');
      } else {
        const possiblePaths = [
          path.join(process.resourcesPath || '', 'build/icon.ico'),
          path.join(process.resourcesPath || '', 'app/build/icon.ico'),
          path.join(__dirname, '../build/icon.ico'),
          path.join(__dirname, '../../build/icon.ico'),
        ];
        iconIcoPath = possiblePaths.find(p => fs.existsSync(p)) || null;
      }
      
      if (iconIcoPath && fs.existsSync(iconIcoPath)) {
        try {
          const icon = nativeImage.createFromPath(iconIcoPath);
          if (!icon.isEmpty()) {
            if (process.platform === 'win32') {
              trayIcon = icon.resize({ width: 16, height: 16 });
            } else {
              trayIcon = icon.resize({ width: 22, height: 22 });
            }
            console.log('[Main] ✅ Трей-иконка создана из icon.ico');
          }
        } catch (e) {
          console.warn('[Main] Ошибка загрузки icon.ico:', e);
        }
      }
    }
    
    // Создаем трей с найденной иконкой
    if (trayIcon && !trayIcon.isEmpty()) {
      try {
        tray = new Tray(trayIcon);
        console.log('[Main] ✅ Трей создан успешно с иконкой размером:', trayIcon.getSize());
        
        // Для Windows пробуем несколько способов установки иконки
        if (process.platform === 'win32' && tray) {
          try {
            // Способ 1: setImage (основной способ)
            console.log('[Main] Пробуем установить иконку через setImage, размер:', trayIcon.getSize());
            tray.setImage(trayIcon);
            console.log('[Main] ✅ Иконка установлена через setImage');
            
            // Способ 2: Попробуем загрузить напрямую из tray-icon.png и установить снова
            if (trayIconPath && fs.existsSync(trayIconPath)) {
              try {
                console.log('[Main] Пробуем переустановить иконку напрямую из файла:', trayIconPath);
                const directIcon = nativeImage.createFromPath(trayIconPath);
                if (!directIcon.isEmpty()) {
                  const directIcon16 = directIcon.resize({ width: 16, height: 16 });
                  if (!directIcon16.isEmpty()) {
                    tray.setImage(directIcon16);
                    console.log('[Main] ✅ Иконка переустановлена напрямую из tray-icon.png, размер:', directIcon16.getSize());
                  } else {
                    console.warn('[Main] Иконка стала пустой после resize');
                  }
                } else {
                  console.warn('[Main] Иконка пустая при прямой загрузке');
                }
              } catch (e) {
                console.warn('[Main] Не удалось установить иконку напрямую из tray-icon.png:', e);
              }
            }
            
            // Способ 3: Логируем успешную установку
            console.log('[Main] ✅ Иконка трея должна быть установлена, размер:', trayIcon.getSize());
          } catch (e) {
            console.error('[Main] ❌ Не удалось установить иконку через setImage:', e);
            if (e instanceof Error) {
              console.error('[Main] Сообщение об ошибке:', e.message);
            }
          }
        }
      } catch (e) {
        console.error('[Main] Ошибка создания трея с иконкой:', e);
        // Пробуем создать трей с пустой иконкой
        tray = new Tray(nativeImage.createEmpty());
      }
    } else {
      console.error('[Main] ❌ Не удалось загрузить иконку для трея');
      // Пробуем создать трей с иконкой из tray-icon.png напрямую
      if (trayIconPath && fs.existsSync(trayIconPath)) {
        try {
          const fallbackIcon = nativeImage.createFromPath(trayIconPath);
          if (!fallbackIcon.isEmpty()) {
            const fallbackIcon16 = fallbackIcon.resize({ width: 16, height: 16 });
            if (!fallbackIcon16.isEmpty()) {
              tray = new Tray(fallbackIcon16);
              console.log('[Main] ✅ Трей создан с иконкой из tray-icon.png (fallback)');
            } else {
              tray = new Tray(nativeImage.createEmpty());
              console.warn('[Main] ⚠️ Трей создан без иконки - tray-icon.png пустой после resize');
            }
          } else {
            tray = new Tray(nativeImage.createEmpty());
            console.warn('[Main] ⚠️ Трей создан без иконки - файл tray-icon.png пустой');
          }
        } catch (e) {
          tray = new Tray(nativeImage.createEmpty());
          console.warn('[Main] ⚠️ Трей создан без иконки - ошибка загрузки tray-icon.png:', e);
        }
      } else {
        tray = new Tray(nativeImage.createEmpty());
        console.warn('[Main] ⚠️ Трей создан без иконки - файл tray-icon.png не найден:', trayIconPath);
      }
    }
  } catch (error) {
    console.error('[Main] ❌ Ошибка создания трея:', error);
    try {
      tray = new Tray(nativeImage.createEmpty());
    } catch (e) {
      console.error('[Main] ❌ Критическая ошибка: не удалось создать трей:', e);
    }
  }

  if (tray) {
    setupTrayMenu();
  }
}

function setupTrayMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Открыть SafeKey',
      click: async () => {
        if (mainWindow) {
          // Проверяем авторизацию перед показом окна
          const appSettings = loadAppSettings();
          if (appSettings.requireAuthOnStartup && !isUserAuthenticated) {
            const authType = appSettings.authType || 'windows-pin';
            if (authType !== 'none') {
              const authResult = await performAuth(authType);
              if (!authResult && authType === 'windows-pin') {
                // Если Windows PIN не подтвержден, не показываем окно
                return;
              }
              // Для app-pin окно покажет диалог ввода PIN
            }
          }
          mainWindow.show();
          mainWindow.focus();
        } else {
          createMainWindow();
        }
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

  tray.on('click', async () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        // Проверяем авторизацию перед показом окна
        const appSettings = loadAppSettings();
        if (appSettings.requireAuthOnStartup && !isUserAuthenticated) {
          const authType = appSettings.authType || 'windows-pin';
          if (authType !== 'none') {
            const authResult = await performAuth(authType);
            if (!authResult && authType === 'windows-pin') {
              // Если Windows PIN не подтвержден, не показываем окно
              return;
            }
            // Для app-pin окно покажет диалог ввода PIN
          }
        }
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

// Функция для определения активного окна/приложения в Windows
async function getActiveWindowApp(): Promise<string | null> {
  if (process.platform !== 'win32') {
    return null;
  }

  try {
    // Используем более надежный метод с полностью скрытым окном PowerShell
    // Используем -WindowStyle Hidden и -NoProfile для максимальной скрытности
    const command = `powershell -WindowStyle Hidden -NoProfile -NonInteractive -Command "$code = @'
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport(\"user32.dll\")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport(\"user32.dll\")]
    public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int ProcessId);
}
'@; Add-Type -TypeDefinition $code; $hwnd = [Win32]::GetForegroundWindow(); $pid = 0; [Win32]::GetWindowThreadProcessId($hwnd, [ref]$pid); if ($pid -gt 0) { $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue; if ($proc -and $proc.MainWindowTitle -ne '') { $proc.ProcessName } }"`;
    
    const { stdout } = await execAsync(command, { 
      timeout: 1000,
      windowsHide: true // Скрываем окно процесса
    });
    const appName = stdout.trim();
    
    // Фильтруем системные процессы, PowerShell и само приложение SafeKey
    if (appName && 
        appName !== 'powershell' && 
        appName !== 'pwsh' && 
        appName !== 'SafeKey' &&
        appName !== 'Code' && // VS Code если открыт
        !appName.toLowerCase().includes('powershell')) {
      console.log('[Main] Активное приложение:', appName);
      return appName;
    } else {
      console.log('[Main] Обнаружено системное/игнорируемое приложение:', appName);
      return null;
    }
  } catch (error) {
    console.error('[Main] Ошибка определения активного окна:', error);
    return null;
  }
}

async function createOverlayWindow() {
  if (overlayWindow) {
    overlayWindow.focus();
    return;
  }

  // Логика открытия оверлея:
  // 1. Если программа авторизована - оверлей открывается сразу без проверки PIN
  // 2. Если программа не авторизована - оверлей открывается и показывает диалог авторизации
  const appSettings = loadAppSettings();
  const authType = appSettings.authType || 'windows-pin';
  
  console.log('[Main] Открываем оверлей. Тип авторизации:', authType, 'Статус в основном окне:', isUserAuthenticated);
  
  // Если авторизация отключена, разрешаем открытие
  if (authType === 'none') {
    isUserAuthenticated = true;
    console.log('[Main] Авторизация отключена, открываем оверлей');
  }
  // Если пользователь авторизован в основном окне, оверлей открывается сразу без проверки
  else if (isUserAuthenticated) {
    console.log('[Main] Пользователь авторизован в основном окне, открываем оверлей сразу без проверки');
    // Оверлей сам проверит авторизацию при загрузке, но мы не блокируем открытие
  }
  // Если пользователь НЕ авторизован, оверлей открывается и покажет диалог авторизации
  else {
    console.log('[Main] Пользователь НЕ авторизован в основном окне, оверлей откроется и покажет диалог авторизации');
    // Оверлей сам покажет диалог авторизации при загрузке
  }

  // ВАЖНО: Определяем активное приложение ДО создания оверлея,
  // потому что после создания оверлей сам становится активным окном
  // Добавляем небольшую задержку, чтобы убедиться, что предыдущее окно все еще активно
  await new Promise(resolve => setTimeout(resolve, 50));
  const activeApp = await getActiveWindowApp();
  console.log('[Main] Активное приложение определено ДО создания оверлея:', activeApp);

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
    backgroundColor: '#00000000', // Полностью прозрачный фон
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      devTools: process.env.NODE_ENV === 'development', // Только в режиме разработки
    },
  });

  // Тема и активное приложение — применяем сразу после загрузки оверлея (без моргания)
  overlayWindow.webContents.once('did-finish-load', () => {
    if (overlayWindow) {
      const overlaySettings = loadAppSettings();
      const overlayTheme = overlaySettings.theme || 'light';
      overlayWindow.webContents.executeJavaScript(
        `document.documentElement.setAttribute('data-theme', ${JSON.stringify(overlayTheme)});`
      ).catch((err: unknown) => console.error('[Main] Ошибка применения темы в оверлее:', err));
      if (activeApp && activeApp !== 'powershell' && activeApp !== 'pwsh' && activeApp !== 'SafeKey') {
        overlayWindow.webContents.send('active-app-detected', activeApp);
        console.log('[Main] Активное приложение передано в оверлей:', activeApp);
      } else {
        console.log('[Main] Активное приложение не передано (системное или не определено):', activeApp);
        overlayWindow.webContents.send('active-app-detected', null);
      }
    }
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
  const registered = globalShortcut.register(currentOverlayShortcut, async () => {
    await createOverlayWindow();
  });
  
  if (!registered) {
    console.error('[Main] Не удалось зарегистрировать горячую клавишу:', currentOverlayShortcut);
  } else {
    console.log('[Main] Горячая клавиша зарегистрирована:', currentOverlayShortcut);
  }
}

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
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
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
  registerOverlayShortcut();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Сбрасываем состояние авторизации при выходе
    isUserAuthenticated = false;
    app.quit();
  }
});

app.on('will-quit', () => {
  // Сбрасываем состояние авторизации при выходе
  isUserAuthenticated = false;
  globalShortcut.unregisterAll();
});

// IPC обработчики для работы с базой данных
let dbService: DatabaseService | null = null;
let encryptionService: EncryptionService | null = null;
let windowsPinAuthService: WindowsPinAuthService | null = null;
let appPinAuthService: AppPinAuthService | null = null;

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

// Универсальная функция проверки авторизации
async function performAuth(authType: string = 'windows-pin'): Promise<boolean> {
  const appSettings = loadAppSettings();
  const type = authType || appSettings.authType || 'windows-pin';

  console.log('[Main] Выполняем авторизацию типа:', type);

  if (type === 'none') {
    console.log('[Main] Авторизация отключена');
    isUserAuthenticated = true;
    return true;
  }

  if (type === 'app-pin') {
    // Для собственного PIN-кода нужно запросить его через диалог
    // Пока возвращаем false, чтобы показать диалог ввода PIN
    console.log('[Main] Требуется PIN-код приложения');
    return false;
  }

  // Windows PIN по умолчанию
  if (!windowsPinAuthService) {
    windowsPinAuthService = new WindowsPinAuthService();
  }
  const result = await windowsPinAuthService.verifyPinCode();
  if (result) {
    isUserAuthenticated = true;
  }
  return result;
}

// Обработчики для проверки PIN-кода Windows
ipcMain.handle('verify-windows-pin', async () => {
  try {
    console.log('[Main] verify-windows-pin вызван');
    if (!windowsPinAuthService) {
      windowsPinAuthService = new WindowsPinAuthService();
    }
    const result = await windowsPinAuthService.verifyPinCode();
    console.log('[Main] Результат проверки PIN-кода:', result);
    if (result) {
      isUserAuthenticated = true;
    }
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

// Обработчики для работы с собственным PIN-кодом приложения
ipcMain.handle('set-app-pin', async (_, pin: string) => {
  try {
    if (!appPinAuthService) {
      appPinAuthService = new AppPinAuthService();
    }
    const result = await appPinAuthService.setPin(pin);
    return { success: result };
  } catch (error) {
    console.error('[Main] Ошибка установки PIN-кода приложения:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Неизвестная ошибка' };
  }
});

ipcMain.handle('verify-app-pin', async (_, pin: string) => {
  try {
    if (!appPinAuthService) {
      appPinAuthService = new AppPinAuthService();
    }
    const result = await appPinAuthService.verifyPin(pin);
    if (result) {
      isUserAuthenticated = true;
    }
    return result;
  } catch (error) {
    console.error('[Main] Ошибка проверки PIN-кода приложения:', error);
    return false;
  }
});

ipcMain.handle('check-app-pin-set', async () => {
  try {
    if (!appPinAuthService) {
      appPinAuthService = new AppPinAuthService();
    }
    return await appPinAuthService.isPinSet();
  } catch (error) {
    console.error('[Main] Ошибка проверки наличия PIN-кода приложения:', error);
    return false;
  }
});

ipcMain.handle('clear-app-pin', async () => {
  try {
    if (!appPinAuthService) {
      appPinAuthService = new AppPinAuthService();
    }
    const result = await appPinAuthService.clearPin();
    return { success: result };
  } catch (error) {
    console.error('[Main] Ошибка удаления PIN-кода приложения:', error);
    return { success: false };
  }
});

ipcMain.handle('check-auth-status', async () => {
  return isUserAuthenticated;
});

ipcMain.handle('reset-auth-status', async () => {
  console.log('[Main] Сброс статуса авторизации');
  isUserAuthenticated = false;
  return { success: true };
});

ipcMain.handle('set-auth-status', async (_, status: boolean) => {
  console.log('[Main] Установка статуса авторизации:', status);
  isUserAuthenticated = status;
  return { success: true };
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
  return dbService.createPasswordEntry(encrypted, entry.title || 'Без названия', entry.category_id, entry.bound_app);
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
  return dbService.updatePasswordEntry(id, encrypted, entry.title, entry.category_id, entry.bound_app);
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

ipcMain.handle('update-password-entry-bound-app', async (_, id: number, boundApp: string | null) => {
  if (!dbService) {
    throw new Error('Database not initialized');
  }
  return dbService.updatePasswordEntryBoundApp(id, boundApp);
});

ipcMain.handle('delete-category', async (_, id: number) => {
  if (!dbService) {
    throw new Error('Database not initialized');
  }
  return dbService.deleteCategory(id);
});

// Получение активного приложения
ipcMain.handle('get-active-app', async () => {
  return await getActiveWindowApp();
});

// Выбор .exe файла для определения приложения
ipcMain.handle('select-exe-file', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Выберите исполняемый файл приложения',
    filters: [
      { name: 'Исполняемые файлы', extensions: ['exe'] },
      { name: 'Все файлы', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const exePath = result.filePaths[0];
  // Извлекаем имя файла без расширения
  const fileName = path.basename(exePath, '.exe');
  console.log('[Main] Выбран .exe файл:', exePath, 'Имя процесса:', fileName);
  return fileName;
});

// Получение списка запущенных приложений (для выбора в настройках)
ipcMain.handle('get-running-apps', async () => {
  if (process.platform !== 'win32') {
    return [];
  }

  try {
    const command = `powershell -Command "Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object -Property ProcessName, MainWindowTitle | Sort-Object ProcessName -Unique | ConvertTo-Json"`;
    const { stdout } = await execAsync(command, { timeout: 5000 });
    const processes = JSON.parse(stdout);
    const apps = Array.isArray(processes) ? processes : [processes];
    // Убираем дубликаты и возвращаем только имена процессов
    const uniqueApps = [...new Set(apps.map((p: any) => p.ProcessName))].filter(Boolean);
    return uniqueApps.sort();
  } catch (error) {
    console.error('[Main] Ошибка получения списка приложений:', error);
    return [];
  }
});

ipcMain.handle('show-delete-category-dialog', async (_, categoryName: string, hasChildren: boolean) => {
  return await showDeleteCategoryDialog(categoryName, hasChildren);
});

ipcMain.handle('show-delete-security-question-dialog', async (_, entryTitle: string) => {
  return await showDeleteSecurityQuestionDialog(entryTitle);
});

ipcMain.handle('show-delete-backup-code-dialog', async (_, codeText: string, isEntry: boolean = false) => {
  return await showDeleteBackupCodeDialog(codeText, isEntry);
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
      const diskPath = (cloudSettings.yandexDisk?.path || 'SafeKey').trim();
      
      cloudSettings.yandexDisk = {
        ...cloudSettings.yandexDisk,
        enabled: true,
        token: token,
      };
      saveCloudSettings(cloudSettings);
      
      // Проверяем директорию на наличие сохраненных файлов
      try {
        const yandexDisk = new YandexDiskService(token, diskPath);
        const files = await yandexDisk.listFiles();
        const backupFiles = files.filter(f => 
          f.startsWith('safekey_backup') && (f.endsWith('.dat') || f.endsWith('.db'))
        );
        
        if (backupFiles.length > 0) {
          console.log('[Main] Найдены существующие файлы резервных копий на Яндекс.Диске:', backupFiles);
          return { 
            success: true, 
            token,
            hasExistingFiles: true,
            files: backupFiles
          };
        }
      } catch (checkError) {
        console.warn('[Main] Ошибка проверки директории на Яндекс.Диске:', checkError);
        // Не критично, продолжаем
      }
      
      return { success: true, token, hasExistingFiles: false };
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
      
      // TODO: Добавить проверку директории на Google Drive при реализации сервиса
      // Пока просто возвращаем успех
      
      return { success: true, token, hasExistingFiles: false };
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
          // Загружаем ключевой файл для восстановления на мобильном (salt + keyHash)
          const keyFilePath = path.join(app.getPath('userData'), 'master.key');
          if (fs.existsSync(keyFilePath)) {
            const keyFileName = 'safekey_key.json';
            const tempKeyPath = path.join(app.getPath('temp'), keyFileName);
            fs.copyFileSync(keyFilePath, tempKeyPath);
            await yandexDisk.uploadFile(tempKeyPath, keyFileName);
            if (fs.existsSync(tempKeyPath)) fs.unlinkSync(tempKeyPath);
          }
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
    // Сворачиваем в трей вместо панели задач
    mainWindow.hide();
    if (!tray) {
      createTray();
    }
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

ipcMain.handle('window-close', async () => {
  if (mainWindow) {
    // Всегда показываем диалог выбора (даже при автозапуске)
    const choice = await showCloseDialog();

    if (choice === 'minimize') {
      // Свернуть в трей
      if (mainWindow) {
        mainWindow.hide();
        if (!tray) {
          createTray();
        }
      }
    } else {
      // Закрыть приложение
      if (mainWindow) {
        mainWindow.destroy();
        mainWindow = null;
      }
      if (overlayWindow) {
        overlayWindow.destroy();
        overlayWindow = null;
      }
      if (tray) {
        tray.destroy();
        tray = null;
      }
      app.quit();
    }
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
      autoStart: false,
      language: 'ru',
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
    if (settings.autoStart && !tray) {
      createTray();
    } else if (!settings.autoStart && tray) {
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
  await createOverlayWindow();
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

