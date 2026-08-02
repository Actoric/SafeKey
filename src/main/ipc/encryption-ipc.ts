import * as os from 'os';
import { ipcMain } from 'electron';
import { runtime } from '../runtime-context';
import { EncryptionService } from '../encryption/encryption';

export function registerEncryptionIpc(): void {
  ipcMain.handle('init-encryption', async () => {
    try {
      if (!runtime.encryptionService) {
        runtime.encryptionService = new EncryptionService();
      }
      if (!runtime.encryptionService.isInitialized()) {
        const username = os.userInfo().username;
        await runtime.encryptionService.setMasterPassword(username + '-safekey-default-key');
      }
      return { success: true };
    } catch (error) {
      console.error('[Main] Ошибка инициализации шифрования:', error);
      throw error;
    }
  });
}
