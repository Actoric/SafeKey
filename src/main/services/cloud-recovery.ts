import * as CryptoJS from 'crypto-js';
import * as os from 'os';
import { APP_CONFIG } from '../config/app.config';

const KEY_SIZE = APP_CONFIG.encryption.keySize;
const IV_SIZE = APP_CONFIG.encryption.ivSize;
const PBKDF2_ITERATIONS = APP_CONFIG.encryption.pbkdf2Iterations;

export type RecoveryPayload = {
  v: 1;
  salt: string;
  iv: string;
  ciphertext: string;
  createdAt: string;
};

export function getMachinePassword(windowsUsername?: string): string {
  const user =
    typeof windowsUsername === 'string' && windowsUsername.trim()
      ? windowsUsername.trim()
      : os.userInfo().username;
  return `${user}-safekey-default-key`;
}

/** Шифрует machine-password кодом восстановления (для загрузки в облако). */
export function wrapMachinePassword(machinePassword: string, recoveryCode: string): RecoveryPayload {
  const salt = CryptoJS.lib.WordArray.random(128 / 8);
  const iv = CryptoJS.lib.WordArray.random(IV_SIZE);
  const key = CryptoJS.PBKDF2(recoveryCode, salt, {
    keySize: KEY_SIZE / 32,
    iterations: PBKDF2_ITERATIONS,
  });

  const encrypted = CryptoJS.AES.encrypt(machinePassword, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return {
    v: 1,
    salt: salt.toString(),
    iv: iv.toString(),
    ciphertext: encrypted.toString(),
    createdAt: new Date().toISOString(),
  };
}

/** Расшифровывает machine-password из recovery-файла. */
export function unwrapMachinePassword(payload: RecoveryPayload, recoveryCode: string): string | null {
  try {
    if (payload.v !== 1 || !payload.salt || !payload.iv || !payload.ciphertext) {
      return null;
    }
    const key = CryptoJS.PBKDF2(recoveryCode, CryptoJS.enc.Hex.parse(payload.salt), {
      keySize: KEY_SIZE / 32,
      iterations: PBKDF2_ITERATIONS,
    });
    const decrypted = CryptoJS.AES.decrypt(payload.ciphertext, key, {
      iv: CryptoJS.enc.Hex.parse(payload.iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    const text = decrypted.toString(CryptoJS.enc.Utf8);
    return text || null;
  } catch {
    return null;
  }
}
