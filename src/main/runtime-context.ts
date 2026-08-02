import type { BrowserWindow, Tray } from 'electron';
import type AutoLaunch from 'auto-launch';
import { DatabaseService } from './database/database';
import { EncryptionService } from './encryption/encryption';
import { WindowsPinAuthService } from './auth/windows-pin-auth';
import { AppPinAuthService } from './auth/app-pin-auth';
import { APP_CONFIG } from './config/app.config';

/** Единое изменяемое состояние main-процесса (окна, трей, сервисы). */
export const runtime = {
  mainWindow: null as BrowserWindow | null,
  overlayWindow: null as BrowserWindow | null,
  tray: null as Tray | null,
  appIcon: null as Electron.NativeImage | null,
  currentOverlayShortcut: APP_CONFIG.shortcuts.overlay,
  autoLauncher: null as AutoLaunch | null,
  isUserAuthenticated: false,
  dbService: null as DatabaseService | null,
  encryptionService: null as EncryptionService | null,
  windowsPinAuthService: null as WindowsPinAuthService | null,
  appPinAuthService: null as AppPinAuthService | null,
};
