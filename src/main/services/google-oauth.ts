import { BrowserWindow } from 'electron';
import * as https from 'https';
import * as http from 'http';

// Google OAuth 2.0 credentials
// ВАЖНО: Эти данные нужно получить в Google Cloud Console
// https://console.cloud.google.com/apis/credentials
const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID'; // Замените на ваш Client ID
const CLIENT_SECRET = 'YOUR_GOOGLE_CLIENT_SECRET'; // Замените на ваш Client Secret
const REDIRECT_URI = 'http://localhost:8080/google-oauth-callback';

interface TokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

/**
 * Сервис для OAuth авторизации Google Drive
 */
export class GoogleOAuthService {
  /**
   * Получить URL для авторизации
   */
  static getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive.file',
      access_type: 'offline',
      prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Обменять код авторизации на токен
   */
  static async exchangeCodeForToken(code: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const postData = new URLSearchParams({
        code: code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }).toString();

      const options = {
        hostname: 'oauth2.googleapis.com',
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
            const response: TokenResponse = JSON.parse(data);
            if (response.access_token) {
              resolve(response.access_token);
            } else {
              console.error('[GoogleOAuth] Ошибка получения токена:', response.error, response.error_description);
              reject(new Error(response.error_description || response.error || 'Неизвестная ошибка'));
            }
          } catch (error) {
            console.error('[GoogleOAuth] Ошибка парсинга ответа:', error);
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        console.error('[GoogleOAuth] Ошибка запроса:', error);
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Авторизация через OAuth
   */
  static async authorize(): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const authUrl = this.getAuthUrl();
      console.log('[GoogleOAuth] URL авторизации:', authUrl);

      // Создаем временное окно для авторизации
      const authWindow = new BrowserWindow({
        width: 500,
        height: 600,
        show: true,
        modal: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      authWindow.loadURL(authUrl);

      // Создаем локальный сервер для получения callback
      const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
        if (req.url?.startsWith('/google-oauth-callback')) {
          const url = new URL(req.url, `http://${req.headers.host}`);
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');

          res.writeHead(200, { 'Content-Type': 'text/html' });
          if (error) {
            res.end('<html><body><h1>Ошибка авторизации</h1><p>Можно закрыть это окно.</p></body></html>');
            authWindow.close();
            server.close();
            reject(new Error(error));
            return;
          }

          if (code) {
            res.end('<html><body><h1>Авторизация успешна!</h1><p>Можно закрыть это окно.</p></body></html>');
            authWindow.close();
            server.close();

            // Обмениваем код на токен
            this.exchangeCodeForToken(code)
              .then((token) => {
                resolve(token);
              })
              .catch((error) => {
                reject(error);
              });
          } else {
            res.end('<html><body><h1>Код не получен</h1><p>Можно закрыть это окно.</p></body></html>');
            authWindow.close();
            server.close();
            reject(new Error('Код авторизации не получен'));
          }
        }
      });

      server.listen(8080, 'localhost', () => {
        console.log('[GoogleOAuth] Сервер callback запущен на localhost:8080');
      });

      authWindow.on('closed', () => {
        server.close();
        reject(new Error('Окно авторизации закрыто'));
      });
    });
  }
}
