import { app } from 'electron';
import AutoLaunch from 'auto-launch';
import { runtime } from './runtime-context';

export function setupAutoLaunch(): void {
  if (process.platform === 'win32') {
    runtime.autoLauncher = new AutoLaunch({
      name: 'SafeKey',
      path: app.getPath('exe'),
    });
  }
}

export async function setAutoLaunch(enabled: boolean): Promise<void> {
  if (!runtime.autoLauncher) {
    setupAutoLaunch();
  }
  if (runtime.autoLauncher) {
    try {
      const isEnabled = await runtime.autoLauncher.isEnabled();
      if (enabled && !isEnabled) {
        await runtime.autoLauncher.enable();
      } else if (!enabled && isEnabled) {
        await runtime.autoLauncher.disable();
      }
    } catch (error) {
      console.error('[AutoLaunch]', error);
    }
  }
}
