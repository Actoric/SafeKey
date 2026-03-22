/**
 * Шифрование в браузере (тот же алгоритм, что и в десктопе: PBKDF2 + AES-CBC).
 * Совместимо с форматом ключа и зашифрованных данных десктопного SafeKey.
 */
import CryptoJS from 'crypto-js';

const KEY_SIZE = 256;
const IV_SIZE = 128 / 8;
const PBKDF2_ITERATIONS = 10000;

export interface KeyData {
  salt: string;
  keyHash: string;
}

let masterKey: string | null = null;

export function setMasterKeyFromKeyData(password: string, keyData: KeyData): boolean {
  try {
    const key = CryptoJS.PBKDF2(password, CryptoJS.enc.Hex.parse(keyData.salt), {
      keySize: KEY_SIZE / 32,
      iterations: PBKDF2_ITERATIONS,
    });
    const keyHash = CryptoJS.SHA256(key.toString()).toString();
    if (keyHash !== keyData.keyHash) return false;
    masterKey = key.toString();
    return true;
  } catch {
    return false;
  }
}

export function createKeyFromPassword(password: string): KeyData {
  const salt = CryptoJS.lib.WordArray.random(128 / 8);
  const key = CryptoJS.PBKDF2(password, salt, {
    keySize: KEY_SIZE / 32,
    iterations: PBKDF2_ITERATIONS,
  });
  masterKey = key.toString();
  return {
    salt: salt.toString(),
    keyHash: CryptoJS.SHA256(masterKey).toString(),
  };
}

function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

export function encrypt(data: string): string {
  if (!masterKey) throw new Error('Master key not set');
  const iv = CryptoJS.lib.WordArray.random(IV_SIZE);
  const encrypted = CryptoJS.AES.encrypt(data, masterKey, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return iv.toString() + ':' + encrypted.toString();
}

export function decrypt(encryptedData: string): string {
  if (!masterKey) throw new Error('Master key not set');
  const parts = encryptedData.split(':');
  if (parts.length !== 2) throw new Error('Invalid encrypted data format');
  const iv = CryptoJS.enc.Hex.parse(parts[0]);
  const decrypted = CryptoJS.AES.decrypt(parts[1], masterKey, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
}

/** Шифрует бинарные данные (база): base64 → encrypt → строка. */
export function encryptFileAsString(fileBytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...fileBytes));
  return encrypt(base64);
}

/** Расшифровывает строку в бинарные данные (база). */
export function decryptFileFromString(encryptedText: string): Uint8Array {
  const base64 = decrypt(encryptedText);
  return base64ToBytes(base64);
}

export function clearMasterKey(): void {
  masterKey = null;
}

export function hasMasterKey(): boolean {
  return masterKey != null;
}
