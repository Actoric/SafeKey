import { globalShortcut } from 'electron';
import { APP_CONFIG } from './config/app.config';
import { loadAppSettings } from './config/app-settings';
import { runtime } from './runtime-context';

export function registerOverlayShortcut(openOverlay: () => Promise<void>): void {
  globalShortcut.unregisterAll();
  const appSettings = loadAppSettings();
  runtime.currentOverlayShortcut = appSettings.overlayShortcut || APP_CONFIG.shortcuts.overlay;
  const registered = globalShortcut.register(runtime.currentOverlayShortcut, () => {
    void openOverlay();
  });
  if (!registered) {
    console.error('[Main] Не удалось зарегистрировать горячую клавишу:', runtime.currentOverlayShortcut);
  }
}
