import * as os from 'os';
import { runtime } from './runtime-context';
import { EncryptionService } from './encryption/encryption';

export async function ensureEncryptionInitialized(): Promise<void> {
  if (!runtime.encryptionService) {
    runtime.encryptionService = new EncryptionService();
  }

  if (!runtime.encryptionService.isInitialized()) {
    const username = os.userInfo().username;
    await runtime.encryptionService.setMasterPassword(username + '-safekey-default-key');
  } else if (!runtime.encryptionService.masterKey) {
    const username = os.userInfo().username;
    const restored = await runtime.encryptionService.restoreMasterKey(username + '-safekey-default-key');
    if (!restored) {
      await runtime.encryptionService.setMasterPassword(username + '-safekey-default-key');
    }
  }
}
