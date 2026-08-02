import { app, BrowserWindow, globalShortcut, screen, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { runtime } from './runtime-context';
import { APP_CONFIG } from './config/app.config';
import { loadAppSettings } from './config/app-settings';
import { initializeUpdater, updateWindowReferences } from './updater/github-updater';
import { showCloseDialog, setMainWindowRef as setCloseDialogMainWindow } from './dialogs/close-dialog';
import { setMainWindowRef as setDeleteCategoryMainWindow } from './dialogs/delete-category-dialog';
import { setMainWindowRef as setDeleteSecurityQuestionMainWindow } from './dialogs/delete-security-question-dialog';
import { setMainWindowRef as setDeleteBackupCodeMainWindow } from './dialogs/delete-backup-code-dialog';

const execAsync = promisify(exec);

let invokeEnsureTray: () => void = () => {};

/** Вызывать из main после объявления ensureTray. */
export function wireWindowsEnsureTray(fn: () => void): void {
  invokeEnsureTray = fn;
}

export async function getActiveWindowApp(): Promise<string | null> {
  if (process.platform !== 'win32') {
    return null;
  }

  try {
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
      windowsHide: true,
    });
    const appName = stdout.trim();

    if (
      appName &&
      appName !== 'powershell' &&
      appName !== 'pwsh' &&
      appName !== 'SafeKey' &&
      appName !== 'Code' &&
      !appName.toLowerCase().includes('powershell')
    ) {
      console.log('[Main] Активное приложение:', appName);
      return appName;
    }
    console.log('[Main] Обнаружено системное/игнорируемое приложение:', appName);
    return null;
  } catch (error) {
    console.error('[Main] Ошибка определения активного окна:', error);
    return null;
  }
}

export function createMainWindow(): void {
  if (runtime.mainWindow && !runtime.mainWindow.isDestroyed()) {
    console.log('[Main] Окно уже существует, фокусируем его');
    if (runtime.mainWindow.isMinimized()) {
      runtime.mainWindow.restore();
    }
    runtime.mainWindow.show();
    runtime.mainWindow.focus();
    return;
  }

  let iconPath: string | undefined;
  if (process.env.NODE_ENV === 'development') {
    const devIconPath = path.join(__dirname, '../../build/icon.ico');
    if (fs.existsSync(devIconPath)) {
      iconPath = devIconPath;
    }
  } else {
    if (process.platform === 'win32') {
      const exePath = process.execPath;
      if (fs.existsSync(exePath)) {
        iconPath = exePath;
      }
    }

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

  const initialSettings = loadAppSettings();
  const windowBgColor = initialSettings.theme === 'dark' ? '#161c1a' : '#eef1ee';

  runtime.mainWindow = new BrowserWindow({
    width: APP_CONFIG.window.main.width,
    height: APP_CONFIG.window.main.height,
    minWidth: APP_CONFIG.window.main.minWidth,
    minHeight: APP_CONFIG.window.main.minHeight,
    maxWidth: APP_CONFIG.window.main.maxWidth,
    maxHeight: APP_CONFIG.window.main.maxHeight,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    titleBarStyle: 'hidden',
    title: 'SafeKey',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      devTools: process.env.NODE_ENV === 'development',
    },
    show: false,
    backgroundColor: windowBgColor,
  });

  if (!runtime.appIcon && iconPath && process.env.NODE_ENV !== 'production') {
    try {
      if (fs.existsSync(iconPath)) {
        const icon = nativeImage.createFromPath(iconPath);
        if (!icon.isEmpty()) {
          if (process.platform === 'win32') {
            runtime.mainWindow.setIcon(icon);
            console.log('[Main] Иконка установлена из (dev mode):', iconPath);
          }
          try {
            const icon16 = icon.resize({ width: 16, height: 16 });
            if (!icon16.isEmpty()) {
              runtime.appIcon = icon16;
              console.log('[Main] Иконка 16x16 сохранена в runtime.appIcon для трея');
            } else {
              runtime.appIcon = icon;
            }
          } catch {
            runtime.appIcon = icon;
          }
        }
      }
    } catch (error) {
      console.error('[Main] Ошибка установки иконки (dev mode):', error);
    }
  } else if (process.env.NODE_ENV === 'production') {
    if (!runtime.appIcon && process.platform === 'win32') {
      try {
        const exePath = process.execPath;
        if (fs.existsSync(exePath)) {
          const icon = nativeImage.createFromPath(exePath);
          if (!icon.isEmpty()) {
            try {
              const icon16 = icon.resize({ width: 16, height: 16 });
              if (!icon16.isEmpty()) {
                runtime.appIcon = icon16;
                console.log('[Main] Иконка 16x16 сохранена из exe для трея');
              } else {
                runtime.appIcon = icon;
              }
            } catch {
              runtime.appIcon = icon;
            }
          }
        }
      } catch (error) {
        console.error('[Main] Ошибка сохранения иконки из exe для трея:', error);
      }
    }
  }

  if (process.env.NODE_ENV === 'development') {
    runtime.mainWindow.loadURL('http://localhost:5173');
    runtime.mainWindow.webContents.openDevTools();
  } else {
    runtime.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  runtime.mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[Main] Ошибка загрузки:', errorCode, errorDescription);
  });

  runtime.mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11') {
      event.preventDefault();
    }
  });

  if (process.env.NODE_ENV === 'development') {
    app.whenReady().then(() => {
      try {
        globalShortcut.register('F12', () => {
          console.log('[Main] F12 нажата');
          if (runtime.mainWindow) {
            if (runtime.mainWindow.webContents.isDevToolsOpened()) {
              runtime.mainWindow.webContents.closeDevTools();
              console.log('[Main] DevTools закрыты через F12');
            } else {
              runtime.mainWindow.webContents.openDevTools();
              console.log('[Main] DevTools открыты через F12');
            }
          }
        });
        globalShortcut.register('CommandOrControl+Shift+I', () => {
          console.log('[Main] Ctrl+Shift+I нажата');
          if (runtime.mainWindow) {
            if (runtime.mainWindow.webContents.isDevToolsOpened()) {
              runtime.mainWindow.webContents.closeDevTools();
              console.log('[Main] DevTools закрыты через Ctrl+Shift+I');
            } else {
              runtime.mainWindow.webContents.openDevTools();
              console.log('[Main] DevTools открыты через Ctrl+Shift+I');
            }
          }
        });
      } catch (error) {
        console.error('[Main] Ошибка регистрации горячих клавиш:', error);
      }
    });
  }

  runtime.mainWindow.on('closed', () => {
    runtime.mainWindow = null;
  });

  runtime.mainWindow.once('ready-to-show', () => {
    if (runtime.mainWindow) {
      setCloseDialogMainWindow(runtime.mainWindow);
      setDeleteCategoryMainWindow(runtime.mainWindow);
      setDeleteSecurityQuestionMainWindow(runtime.mainWindow);
      setDeleteBackupCodeMainWindow(runtime.mainWindow);

      if (!runtime.appIcon && iconPath) {
        try {
          const exePath = process.platform === 'win32' ? process.execPath : iconPath;
          if (fs.existsSync(exePath)) {
            const icon = nativeImage.createFromPath(exePath);
            if (!icon.isEmpty()) {
              try {
                const icon16 = icon.resize({ width: 16, height: 16 });
                if (!icon16.isEmpty()) {
                  runtime.appIcon = icon16;
                  console.log('[Main] Иконка 16x16 сохранена в runtime.appIcon для трея');
                } else {
                  runtime.appIcon = icon;
                }
              } catch {
                runtime.appIcon = icon;
              }
            }
          }
        } catch (error) {
          console.error('[Main] Ошибка сохранения иконки для трея:', error);
        }
      }

      const appSettings = loadAppSettings();
      const theme = appSettings.theme || 'light';
      runtime.mainWindow.webContents
        .executeJavaScript(
          `document.documentElement.setAttribute('data-theme', ${JSON.stringify(theme)});`
        )
        .then(() => {
          if (!runtime.mainWindow || runtime.mainWindow.isDestroyed()) return;
          if (appSettings.autoStart) {
            console.log('[Main] Автозапуск включен, сворачиваем в трей');
            if (!runtime.tray) invokeEnsureTray();
            runtime.mainWindow.hide();
          } else {
            runtime.mainWindow.show();
            runtime.mainWindow.focus();
          }
          initializeUpdater(runtime.mainWindow, runtime.overlayWindow, runtime.tray);
        })
        .catch((err: unknown) => {
          console.error('[Main] Ошибка применения темы:', err);
          if (runtime.mainWindow && !runtime.mainWindow.isDestroyed()) {
            if (appSettings.autoStart) {
              if (!runtime.tray) invokeEnsureTray();
              runtime.mainWindow.hide();
            } else {
              runtime.mainWindow.show();
              runtime.mainWindow.focus();
            }
            initializeUpdater(runtime.mainWindow, runtime.overlayWindow, runtime.tray);
          }
        });
    }
  });

  runtime.mainWindow.on('closed', () => {
    setCloseDialogMainWindow(null);
    setDeleteCategoryMainWindow(null);
    setDeleteSecurityQuestionMainWindow(null);
  });

  runtime.mainWindow.on('close', async (event) => {
    const appSettings = loadAppSettings();

    if (appSettings.autoStart) {
      event.preventDefault();
      if (runtime.mainWindow) {
        runtime.mainWindow.hide();
        if (!runtime.tray) {
          invokeEnsureTray();
        }
      }
      return;
    }

    event.preventDefault();

    const choice = await showCloseDialog();

    if (choice === 'minimize') {
      if (runtime.mainWindow) {
        runtime.mainWindow.hide();
        if (!runtime.tray) {
          invokeEnsureTray();
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
  });
}

export async function createOverlayWindow(): Promise<void> {
  if (runtime.overlayWindow) {
    runtime.overlayWindow.focus();
    return;
  }

  const appSettings = loadAppSettings();
  const authType = appSettings.authType || 'windows-pin';

  console.log(
    '[Main] Открываем оверлей. Тип авторизации:',
    authType,
    'Статус в основном окне:',
    runtime.isUserAuthenticated
  );

  if (authType === 'none') {
    runtime.isUserAuthenticated = true;
    console.log('[Main] Авторизация отключена, открываем оверлей');
  } else if (runtime.isUserAuthenticated) {
    console.log('[Main] Пользователь авторизован в основном окне, открываем оверлей сразу без проверки');
  } else {
    console.log('[Main] Пользователь НЕ авторизован в основном окне, оверлей откроется и покажет диалог авторизации');
  }

  await new Promise((resolve) => setTimeout(resolve, 50));
  const activeApp = await getActiveWindowApp();
  console.log('[Main] Активное приложение определено ДО создания оверлея:', activeApp);

  const displays = screen.getAllDisplays();
  const primaryDisplay = displays[0];

  runtime.overlayWindow = new BrowserWindow({
    width: APP_CONFIG.window.overlay.width,
    height: APP_CONFIG.window.overlay.height,
    x: Math.round((primaryDisplay.workAreaSize.width - 600) / 2),
    y: Math.round((primaryDisplay.workAreaSize.height - 500) / 4),
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      devTools: process.env.NODE_ENV === 'development',
    },
  });

  runtime.overlayWindow.webContents.once('did-finish-load', () => {
    if (runtime.overlayWindow) {
      const overlaySettings = loadAppSettings();
      const overlayTheme = overlaySettings.theme || 'light';
      runtime.overlayWindow.webContents
        .executeJavaScript(
          `document.documentElement.setAttribute('data-theme', ${JSON.stringify(overlayTheme)});`
        )
        .catch((err: unknown) => console.error('[Main] Ошибка применения темы в оверлее:', err));
      if (activeApp && activeApp !== 'powershell' && activeApp !== 'pwsh' && activeApp !== 'SafeKey') {
        runtime.overlayWindow.webContents.send('active-app-detected', activeApp);
        console.log('[Main] Активное приложение передано в оверлей:', activeApp);
      } else {
        console.log('[Main] Активное приложение не передано (системное или не определено):', activeApp);
        runtime.overlayWindow.webContents.send('active-app-detected', null);
      }
    }
  });

  if (process.env.NODE_ENV === 'development') {
    runtime.overlayWindow.loadURL('http://localhost:5173/#/overlay');
  } else {
    runtime.overlayWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: 'overlay',
    });
  }

  runtime.overlayWindow.on('closed', () => {
    runtime.overlayWindow = null;
    updateWindowReferences(runtime.mainWindow, runtime.overlayWindow, runtime.tray);
  });

  runtime.overlayWindow.on('blur', () => {
    if (runtime.overlayWindow) {
      runtime.overlayWindow.close();
    }
  });

  updateWindowReferences(runtime.mainWindow, runtime.overlayWindow, runtime.tray);
}
