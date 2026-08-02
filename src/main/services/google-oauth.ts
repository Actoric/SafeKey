import { BrowserWindow } from 'electron';
import * as https from 'https';
import * as http from 'http';

const CLIENT_ID = process.env.SAFEKEY_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';
const CLIENT_SECRET = process.env.SAFEKEY_GOOGLE_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET';
const REDIRECT_URI = 'http://localhost:8080/google-oauth-callback';

interface TokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

export type GoogleAuthResult = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
};

function postForm(pathName: string, body: URLSearchParams): Promise<TokenResponse> {
  return new Promise((resolve, reject) => {
    const postData = body.toString();
    const req = https.request(
      {
        hostname: 'oauth2.googleapis.com',
        path: pathName,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data) as TokenResponse);
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Сервис для OAuth авторизации Google Drive
 */
export class GoogleOAuthService {
  static isConfigured(): boolean {
    return !CLIENT_ID.includes('YOUR_GOOGLE') && !CLIENT_SECRET.includes('YOUR_GOOGLE');
  }

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

  static async exchangeCodeForToken(code: string): Promise<GoogleAuthResult> {
    const response = await postForm(
      '/token',
      new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      })
    );

    if (!response.access_token) {
      throw new Error(response.error_description || response.error || 'Неизвестная ошибка');
    }

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expiresIn: response.expires_in,
    };
  }

  static async refreshAccessToken(refreshToken: string): Promise<GoogleAuthResult> {
    const response = await postForm(
      '/token',
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      })
    );

    if (!response.access_token) {
      throw new Error(response.error_description || response.error || 'Не удалось обновить токен');
    }

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token || refreshToken,
      expiresIn: response.expires_in,
    };
  }

  static async authorize(): Promise<GoogleAuthResult | null> {
    if (!this.isConfigured()) {
      throw new Error(
        'Google Drive не настроен: задайте SAFEKEY_GOOGLE_CLIENT_ID и SAFEKEY_GOOGLE_CLIENT_SECRET'
      );
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        fn();
      };

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

      authWindow.loadURL(this.getAuthUrl());

      const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
        if (!req.url?.startsWith('/google-oauth-callback')) return;

        const url = new URL(req.url, `http://${req.headers.host}`);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

        if (error) {
          res.end('<html><body><h1>Ошибка авторизации</h1><p>Можно закрыть это окно.</p></body></html>');
          authWindow.close();
          server.close();
          settle(() => reject(new Error(error)));
          return;
        }

        if (!code) {
          res.end('<html><body><h1>Код не получен</h1><p>Можно закрыть это окно.</p></body></html>');
          authWindow.close();
          server.close();
          settle(() => reject(new Error('Код авторизации не получен')));
          return;
        }

        res.end('<html><body><h1>Авторизация успешна!</h1><p>Можно закрыть это окно.</p></body></html>');
        authWindow.close();
        server.close();

        this.exchangeCodeForToken(code)
          .then((token) => settle(() => resolve(token)))
          .catch((err) => settle(() => reject(err)));
      });

      server.listen(8080, 'localhost', () => {
        console.log('[GoogleOAuth] Сервер callback запущен на localhost:8080');
      });

      authWindow.on('closed', () => {
        server.close();
        settle(() => reject(new Error('Окно авторизации закрыто')));
      });
    });
  }
}
