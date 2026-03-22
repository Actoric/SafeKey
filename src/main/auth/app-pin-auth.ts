import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import * as crypto from 'crypto';

/**
 * Сервис для хранения и проверки собственного PIN-кода приложения
 */
export class AppPinAuthService {
  private pinFilePath: string;

  constructor() {
    this.pinFilePath = path.join(app.getPath('userData'), 'app-pin.hash');
  }

  /**
   * Проверяет, установлен ли PIN-код приложения
   */
  async isPinSet(): Promise<boolean> {
    try {
      return fs.existsSync(this.pinFilePath);
    } catch (error) {
      console.error('[AppPinAuth] Ошибка проверки наличия PIN-кода:', error);
      return false;
    }
  }

  /**
   * Устанавливает PIN-код приложения
   */
  async setPin(pin: string): Promise<boolean> {
    try {
      if (!pin || pin.length < 4) {
        throw new Error('PIN-код должен содержать минимум 4 символа');
      }

      // Хешируем PIN-код с солью
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(pin, salt, 10000, 64, 'sha512').toString('hex');
      const data = JSON.stringify({ salt, hash });

      // Сохраняем в файл
      const dir = path.dirname(this.pinFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.pinFilePath, data, 'utf-8');
      
      console.log('[AppPinAuth] PIN-код установлен');
      return true;
    } catch (error) {
      console.error('[AppPinAuth] Ошибка установки PIN-кода:', error);
      return false;
    }
  }

  /**
   * Проверяет PIN-код приложения
   */
  async verifyPin(pin: string): Promise<boolean> {
    try {
      if (!fs.existsSync(this.pinFilePath)) {
        console.log('[AppPinAuth] PIN-код не установлен');
        return false;
      }

      const data = fs.readFileSync(this.pinFilePath, 'utf-8');
      const { salt, hash } = JSON.parse(data);

      // Проверяем PIN-код
      const testHash = crypto.pbkdf2Sync(pin, salt, 10000, 64, 'sha512').toString('hex');
      const isValid = testHash === hash;

      if (isValid) {
        console.log('[AppPinAuth] PIN-код верный');
      } else {
        console.log('[AppPinAuth] PIN-код неверный');
      }

      return isValid;
    } catch (error) {
      console.error('[AppPinAuth] Ошибка проверки PIN-кода:', error);
      return false;
    }
  }

  /**
   * Удаляет PIN-код приложения
   */
  async clearPin(): Promise<boolean> {
    try {
      if (fs.existsSync(this.pinFilePath)) {
        fs.unlinkSync(this.pinFilePath);
        console.log('[AppPinAuth] PIN-код удален');
      }
      return true;
    } catch (error) {
      console.error('[AppPinAuth] Ошибка удаления PIN-кода:', error);
      return false;
    }
  }
}
