import { BrowserWindow } from 'electron';
import * as https from 'https';
import * as http from 'http';

const CLIENT_ID = 'd0370b9cde634c51b74492b338fd1250';
const CLIENT_SECRET = 'fd0386685ca64690be1d14817561d7b3';
const REDIRECT_URI = 'https://oauth.yandex.ru/verification_code';

interface TokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

/**
 * Сервис для OAuth авторизации Яндекс.Диска
 */
export class YandexOAuthService {
  /**
   * Получить URL для авторизации
   */
  static getAuthUrl(): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
    });
    return `https://oauth.yandex.ru/authorize?${params.toString()}`;
  }

  /**
   * Обменять код авторизации на токен
   */
  static async exchangeCodeForToken(code: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const postData = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }).toString();

      const options = {
        hostname: 'oauth.yandex.ru',
        path: '/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const response = JSON.parse(data) as TokenResponse;
            if (response.access_token) {
              resolve(response.access_token);
            } else {
              console.error('[YandexOAuth] Ошибка получения токена:', response.error_description || response.error);
              resolve(null);
            }
          } catch (error) {
            console.error('[YandexOAuth] Ошибка парсинга ответа:', error);
            resolve(null);
          }
        });
      });

      req.on('error', (error) => {
        console.error('[YandexOAuth] Ошибка запроса:', error);
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Открыть окно авторизации и получить токен
   */
  static async authorize(): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const authUrl = this.getAuthUrl();
      
      // Создаем окно для авторизации
      const authWindow = new BrowserWindow({
        width: 500,
        height: 700,
        show: true,
        autoHideMenuBar: true, // Скрываем панель с вкладками
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      let codeReceived = false;
      let windowClosedByUser = false;

      // Отслеживаем закрытие окна пользователем
      authWindow.on('close', (event) => {
        if (!codeReceived) {
          windowClosedByUser = true;
        }
      });

      // Отслеживаем изменения URL
      authWindow.webContents.on('did-navigate', (event, navigationUrl) => {
        try {
          const url = new URL(navigationUrl);
          if (url.hostname === 'oauth.yandex.ru' && url.pathname === '/verification_code') {
            const code = url.searchParams.get('code');
            if (code && !codeReceived) {
              codeReceived = true;
              // Не закрываем окно сразу, даем пользователю увидеть успешную авторизацию
              setTimeout(() => {
                authWindow.close();
              }, 500);
              
              this.exchangeCodeForToken(code)
                .then((token) => {
                  if (token) {
                    resolve(token);
                  } else {
                    reject(new Error('Не удалось получить токен'));
                  }
                })
                .catch((error) => {
                  reject(error);
                });
            }
          }
        } catch (error) {
          console.error('[YandexOAuth] Ошибка обработки навигации:', error);
        }
      });

      // Отслеживаем redirect
      authWindow.webContents.on('will-redirect', (event, navigationUrl) => {
        try {
          const url = new URL(navigationUrl);
          if (url.hostname === 'oauth.yandex.ru' && url.pathname === '/verification_code') {
            const code = url.searchParams.get('code');
            if (code && !codeReceived) {
              codeReceived = true;
              event.preventDefault();
              authWindow.close();
              
              this.exchangeCodeForToken(code)
                .then((token) => {
                  if (token) {
                    resolve(token);
                  } else {
                    reject(new Error('Не удалось получить токен'));
                  }
                })
                .catch((error) => {
                  reject(error);
                });
            }
          }
        } catch (error) {
          console.error('[YandexOAuth] Ошибка обработки redirect:', error);
        }
      });

      authWindow.loadURL(authUrl);

      // Если окно закрыто пользователем до получения кода
      authWindow.on('closed', () => {
        if (!codeReceived && windowClosedByUser) {
          resolve(null);
        }
      });
    });
  }
}

