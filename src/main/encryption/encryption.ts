import * as CryptoJS from 'crypto-js';
import * as fs from 'fs';
import { PATHS } from '../config/paths.config';
import { APP_CONFIG } from '../config/app.config';

const KEY_SIZE = APP_CONFIG.encryption.keySize;
const IV_SIZE = APP_CONFIG.encryption.ivSize;
const PBKDF2_ITERATIONS = APP_CONFIG.encryption.pbkdf2Iterations;

export class EncryptionService {
  public masterKey: string | null = null;
  private keyFilePath: string;

  constructor() {
    this.keyFilePath = PATHS.masterKey();
    // Автоматически загружаем ключ при создании, если файл существует
    this.loadMasterKeyIfExists();
  }

  private loadMasterKeyIfExists(): void {
    // Метод оставлен для совместимости, но загрузка ключа происходит через setMasterPassword
  }

  /**
   * Восстанавливает мастер-ключ из файла, используя пароль
   * Если файл существует, но ключ не загружен, пересоздает ключ с тем же паролем
   */
  async restoreMasterKey(password: string): Promise<boolean> {
    if (!fs.existsSync(this.keyFilePath)) {
      return false;
    }

    try {
      // Пытаемся загрузить ключ через verifyMasterPassword
      return await this.verifyMasterPassword(password);
    } catch (error) {
      console.error('[EncryptionService] Ошибка восстановления ключа:', error);
      return false;
    }
  }

  async setMasterPassword(password: string): Promise<void> {
    // Генерируем ключ из пароля с помощью PBKDF2
    const salt = CryptoJS.lib.WordArray.random(128 / 8);
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: KEY_SIZE / 32,
      iterations: PBKDF2_ITERATIONS,
    });

    this.masterKey = key.toString();

    // Сохраняем соль для будущей проверки
    const keyData = {
      salt: salt.toString(),
      keyHash: CryptoJS.SHA256(this.masterKey).toString(),
    };

    fs.writeFileSync(this.keyFilePath, JSON.stringify(keyData), { flag: 'w' });
  }

  async verifyMasterPassword(password: string): Promise<boolean> {
    if (!fs.existsSync(this.keyFilePath)) {
      return false;
    }

    try {
      const keyData = JSON.parse(fs.readFileSync(this.keyFilePath, 'utf-8'));
      const key = CryptoJS.PBKDF2(password, CryptoJS.enc.Hex.parse(keyData.salt), {
        keySize: KEY_SIZE / 32,
        iterations: PBKDF2_ITERATIONS,
      });

      const keyHash = CryptoJS.SHA256(key.toString()).toString();
      
      if (keyHash === keyData.keyHash) {
        this.masterKey = key.toString();
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  encrypt(data: string): string {
    if (!this.masterKey) {
      // Пытаемся автоматически инициализировать, если ключ не установлен
      if (this.isInitialized()) {
        // Если файл существует, но ключ не загружен, нужно пересоздать ключ
        // Это происходит только если файл был создан, но ключ не был загружен в память
        throw new Error('Master key not loaded. Please reinitialize encryption.');
      }
      throw new Error('Master password not set');
    }

    const iv = CryptoJS.lib.WordArray.random(IV_SIZE);
    const encrypted = CryptoJS.AES.encrypt(data, this.masterKey, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    // Сохраняем IV вместе с зашифрованными данными
    return iv.toString() + ':' + encrypted.toString();
  }

  decrypt(encryptedData: string): string {
    if (!this.masterKey) {
      // Пытаемся автоматически инициализировать, если ключ не установлен
      if (this.isInitialized()) {
        // Если файл существует, но ключ не загружен, нужно пересоздать ключ
        throw new Error('Master key not loaded. Please reinitialize encryption.');
      }
      throw new Error('Master password not set');
    }

    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = CryptoJS.enc.Hex.parse(parts[0]);
    const encrypted = parts[1];

    const decrypted = CryptoJS.AES.decrypt(encrypted, this.masterKey, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  isInitialized(): boolean {
    return fs.existsSync(this.keyFilePath);
  }

  /**
   * Шифрует файл базы данных для безопасной загрузки в облако
   */
  encryptFile(filePath: string, outputPath: string): void {
    if (!this.masterKey) {
      throw new Error('Master password not set');
    }

    const fileContent = fs.readFileSync(filePath);
    const fileData = fileContent.toString('base64');
    const encrypted = this.encrypt(fileData);
    
    fs.writeFileSync(outputPath, encrypted, 'utf-8');
  }

  /**
   * Расшифровывает файл базы данных из облака
   */
  decryptFile(encryptedFilePath: string, outputPath: string): void {
    if (!this.masterKey) {
      throw new Error('Master password not set');
    }

    const encrypted = fs.readFileSync(encryptedFilePath, 'utf-8');
    const decrypted = this.decrypt(encrypted);
    const fileContent = Buffer.from(decrypted, 'base64');
    
    fs.writeFileSync(outputPath, fileContent);
  }
}
