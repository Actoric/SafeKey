import { ipcMain } from 'electron';
import { runtime } from '../runtime-context';
import { WindowsPinAuthService } from '../auth/windows-pin-auth';
import { AppPinAuthService } from '../auth/app-pin-auth';

export function registerAuthIpc(): void {
  ipcMain.handle('verify-windows-pin', async () => {
    try {
      if (!runtime.windowsPinAuthService) {
        runtime.windowsPinAuthService = new WindowsPinAuthService();
      }
      const result = await runtime.windowsPinAuthService.verifyPinCode();
      if (result) {
        runtime.isUserAuthenticated = true;
      }
      return result;
    } catch (error) {
      console.error('[Main] Ошибка проверки PIN-кода:', error);
      return false;
    }
  });

  ipcMain.handle('check-windows-pin-available', async () => {
    try {
      if (!runtime.windowsPinAuthService) {
        runtime.windowsPinAuthService = new WindowsPinAuthService();
      }
      return await runtime.windowsPinAuthService.checkPinCodeAvailable();
    } catch (error) {
      console.error('[Main] Ошибка проверки доступности PIN-кода:', error);
      return false;
    }
  });

  ipcMain.handle('set-app-pin', async (_, pin: string) => {
    try {
      if (!runtime.appPinAuthService) {
        runtime.appPinAuthService = new AppPinAuthService();
      }
      const result = await runtime.appPinAuthService.setPin(pin);
      return { success: result };
    } catch (error) {
      console.error('[Main] Ошибка установки PIN-кода приложения:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Неизвестная ошибка' };
    }
  });

  ipcMain.handle('verify-app-pin', async (_, pin: string) => {
    try {
      if (!runtime.appPinAuthService) {
        runtime.appPinAuthService = new AppPinAuthService();
      }
      const result = await runtime.appPinAuthService.verifyPin(pin);
      if (result) {
        runtime.isUserAuthenticated = true;
      }
      return result;
    } catch (error) {
      console.error('[Main] Ошибка проверки PIN-кода приложения:', error);
      return false;
    }
  });

  ipcMain.handle('check-app-pin-set', async () => {
    try {
      if (!runtime.appPinAuthService) {
        runtime.appPinAuthService = new AppPinAuthService();
      }
      return await runtime.appPinAuthService.isPinSet();
    } catch (error) {
      console.error('[Main] Ошибка проверки наличия PIN-кода приложения:', error);
      return false;
    }
  });

  ipcMain.handle('clear-app-pin', async () => {
    try {
      if (!runtime.appPinAuthService) {
        runtime.appPinAuthService = new AppPinAuthService();
      }
      const result = await runtime.appPinAuthService.clearPin();
      return { success: result };
    } catch (error) {
      console.error('[Main] Ошибка удаления PIN-кода приложения:', error);
      return { success: false };
    }
  });

  ipcMain.handle('check-auth-status', async () => runtime.isUserAuthenticated);

  ipcMain.handle('reset-auth-status', async () => {
    runtime.isUserAuthenticated = false;
    return { success: true };
  });

  ipcMain.handle('set-auth-status', async (_, status: boolean) => {
    runtime.isUserAuthenticated = status;
    return { success: true };
  });
}
