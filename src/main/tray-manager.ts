import { app, Menu, Tray, nativeImage, type BrowserWindow, type NativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { loadAppSettings } from './config/app-settings';
import { updateWindowReferences } from './updater/github-updater';

export interface TrayManagerContext {
  getMainWindow: () => BrowserWindow | null;
  getOverlayWindow: () => BrowserWindow | null;
  getTray: () => Tray | null;
  setTray: (t: Tray | null) => void;
  getAppIcon: () => NativeImage | null;
  getIsUserAuthenticated: () => boolean;
  createMainWindow: () => void;
  performAuth: (authType: string) => Promise<boolean>;
  destroyMainAndOverlay: () => void;
}

function resolveTrayPngPath(): string | null {
  if (process.env.NODE_ENV === 'development') {
    const p = path.join(__dirname, '../../build/tray-icon.png');
    return fs.existsSync(p) ? p : null;
  }
  const candidates = [
    path.join(process.resourcesPath || '', 'build/tray-icon.png'),
    path.join(process.resourcesPath || '', 'app/build/tray-icon.png'),
    path.join(__dirname, '../build/tray-icon.png'),
    path.join(__dirname, '../../build/tray-icon.png'),
    path.join(app.getAppPath(), 'build/tray-icon.png'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function resolveIcoPath(): string | null {
  if (process.env.NODE_ENV === 'development') {
    const p = path.join(__dirname, '../../build/icon.ico');
    return fs.existsSync(p) ? p : null;
  }
  const candidates = [
    path.join(process.resourcesPath || '', 'build/icon.ico'),
    path.join(process.resourcesPath || '', 'app/build/icon.ico'),
    path.join(__dirname, '../build/icon.ico'),
    path.join(__dirname, '../../build/icon.ico'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function toTraySize(icon: Electron.NativeImage): Electron.NativeImage {
  const w = process.platform === 'win32' ? 16 : 22;
  const sz = icon.getSize();
  if (sz.width === w && sz.height === w) return icon;
  try {
    return icon.resize({ width: w, height: w });
  } catch {
    return icon;
  }
}

function loadTrayImage(trayPng: string | null, appIcon: NativeImage | null): Electron.NativeImage | null {
  if (trayPng && fs.existsSync(trayPng)) {
    try {
      const img = nativeImage.createFromPath(trayPng);
      if (!img.isEmpty()) return toTraySize(img);
    } catch (e) {
      console.error('[Tray] tray-icon.png:', e);
    }
  }
  if (appIcon && !appIcon.isEmpty()) {
    return toTraySize(appIcon);
  }
  const ico = resolveIcoPath();
  if (ico) {
    try {
      const img = nativeImage.createFromPath(ico);
      if (!img.isEmpty()) return toTraySize(img);
    } catch (e) {
      console.error('[Tray] icon.ico:', e);
    }
  }
  return null;
}

function setupTrayMenu(tray: Tray, ctx: TrayManagerContext): void {
  const showMain = async () => {
    const mw = ctx.getMainWindow();
    if (mw) {
      const appSettings = loadAppSettings();
      if (appSettings.requireAuthOnStartup && !ctx.getIsUserAuthenticated()) {
        const authType = appSettings.authType || 'windows-pin';
        if (authType !== 'none') {
          const ok = await ctx.performAuth(authType);
          if (!ok && authType === 'windows-pin') return;
        }
      }
      mw.show();
      mw.focus();
    } else {
      ctx.createMainWindow();
    }
  };

  const quitAll = () => {
    ctx.destroyMainAndOverlay();
    const tr = ctx.getTray();
    if (tr) {
      tr.destroy();
      ctx.setTray(null);
    }
    app.quit();
  };

  tray.setToolTip('SafeKey');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Открыть SafeKey',
        click: () => {
          void showMain();
        },
      },
      { type: 'separator' },
      {
        label: 'Выход',
        click: quitAll,
      },
    ])
  );

  tray.on('click', () => {
    void (async () => {
      const mw = ctx.getMainWindow();
      if (mw) {
        if (mw.isVisible()) {
          mw.hide();
        } else {
          await showMain();
        }
      } else {
        ctx.createMainWindow();
      }
    })();
  });

  updateWindowReferences(ctx.getMainWindow(), ctx.getOverlayWindow(), tray);
}

export function createTrayFromContext(ctx: TrayManagerContext): void {
  if (ctx.getTray()) return;

  const trayPng = resolveTrayPngPath();
  const img = loadTrayImage(trayPng, ctx.getAppIcon());
  let instance: Tray;
  try {
    instance = img && !img.isEmpty() ? new Tray(img) : new Tray(nativeImage.createEmpty());
    if (process.platform === 'win32' && img && !img.isEmpty()) {
      try {
        instance.setImage(img);
      } catch {
        /* ignore */
      }
    }
  } catch (e) {
    console.error('[Tray] create:', e);
    instance = new Tray(nativeImage.createEmpty());
  }

  ctx.setTray(instance);
  setupTrayMenu(instance, ctx);
}
