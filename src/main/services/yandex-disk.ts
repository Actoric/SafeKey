import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

interface YandexDiskResponse {
  href?: string;
  method?: string;
  templated?: boolean;
}

// Вспомогательная функция для HTTP запросов
function httpRequest(url: string, options: { method?: string; headers?: Record<string, string>; body?: Buffer } = {}): Promise<{ status: number; data: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = httpModule.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode || 500, data });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

export class YandexDiskService {
  private token: string;
  private basePath: string;

  constructor(token: string, basePath: string = '/SafeKey') {
    this.token = token;
    this.basePath = basePath;
  }

  /**
   * Загрузить файл на Яндекс.Диск
   */
  async uploadFile(localFilePath: string, remoteFileName: string): Promise<boolean> {
    try {
      // Нормализуем basePath - убираем начальный слэш если есть
      let normalizedBasePath = this.basePath.trim();
      if (normalizedBasePath.startsWith('/')) {
        normalizedBasePath = normalizedBasePath.substring(1);
      }
      // Формируем полный путь: disk:/path/filename
      const fullPath = normalizedBasePath ? `disk:/${normalizedBasePath}/${remoteFileName}` : `disk:/${remoteFileName}`;
      
      // 1. Получаем URL для загрузки
      const uploadUrl = await this.getUploadUrl(fullPath);
      if (!uploadUrl) {
        console.error('[YandexDisk] Не удалось получить URL для загрузки');
        return false;
      }

      // 2. Читаем файл
      const fileContent = fs.readFileSync(localFilePath);

      // 3. Загружаем файл
      const response = await httpRequest(uploadUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `OAuth ${this.token}`,
        },
        body: fileContent,
      });

      if (response.status >= 200 && response.status < 300) {
        console.log('[YandexDisk] Файл успешно загружен:', remoteFileName);
        return true;
      } else {
        console.error('[YandexDisk] Ошибка загрузки файла:', response.status, response.data);
        return false;
      }
    } catch (error) {
      console.error('[YandexDisk] Ошибка при загрузке файла:', error);
      return false;
    }
  }

  /**
   * Получить URL для загрузки файла
   */
  private async getUploadUrl(remotePath: string): Promise<string | null> {
    try {
      // Убеждаемся, что папка существует
      const dirPath = path.dirname(remotePath).replace('disk:', '').replace(/^\//, '');
      await this.ensureDirectory(dirPath);

      const url = `https://cloud-api.yandex.net/v1/disk/resources/upload?path=${encodeURIComponent(remotePath)}&overwrite=true`;
      const response = await httpRequest(url, {
        method: 'GET',
        headers: {
          'Authorization': `OAuth ${this.token}`,
        },
      });

      if (response.status >= 200 && response.status < 300) {
        const data = JSON.parse(response.data) as YandexDiskResponse;
        return data.href || null;
      } else {
        console.error('[YandexDisk] Ошибка получения upload URL:', response.status, response.data);
        return null;
      }
    } catch (error) {
      console.error('[YandexDisk] Ошибка при получении upload URL:', error);
      return null;
    }
  }

  /**
   * Проверить, существует ли файл на диске
   */
  async fileExists(remoteFileName: string): Promise<boolean> {
    try {
      // Нормализуем basePath
      let normalizedBasePath = this.basePath.trim();
      if (normalizedBasePath.startsWith('/')) {
        normalizedBasePath = normalizedBasePath.substring(1);
      }
      const remotePath = normalizedBasePath ? `disk:/${normalizedBasePath}/${remoteFileName}` : `disk:/${remoteFileName}`;
      const url = `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(remotePath)}`;
      const response = await httpRequest(url, {
        method: 'GET',
        headers: {
          'Authorization': `OAuth ${this.token}`,
        },
      });
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      console.error('[YandexDisk] Ошибка проверки существования файла:', error);
      return false;
    }
  }

  /**
   * Получить список файлов в папке
   */
  async listFiles(): Promise<string[]> {
    try {
      // Нормализуем basePath
      let normalizedBasePath = this.basePath.trim();
      if (normalizedBasePath.startsWith('/')) {
        normalizedBasePath = normalizedBasePath.substring(1);
      }
      const searchPath = normalizedBasePath ? `disk:/${normalizedBasePath}` : 'disk:/';
      
      const url = `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(searchPath)}&limit=100`;
      const response = await httpRequest(url, {
        method: 'GET',
        headers: {
          'Authorization': `OAuth ${this.token}`,
        },
      });

      if (response.status >= 200 && response.status < 300) {
        const data = JSON.parse(response.data);
        if (data._embedded && data._embedded.items) {
          return data._embedded.items
            .filter((item: any) => item.type === 'file')
            .map((item: any) => item.name);
        }
      }
      return [];
    } catch (error) {
      console.error('[YandexDisk] Ошибка получения списка файлов:', error);
      return [];
    }
  }

  /**
   * Убедиться, что директория существует на диске
   */
  private async ensureDirectory(dirPath: string): Promise<boolean> {
    try {
      // Нормализуем путь - убираем начальный слэш если есть, но оставляем структуру
      let normalizedPath = dirPath.trim();
      if (normalizedPath.startsWith('/')) {
        normalizedPath = normalizedPath.substring(1);
      }
      if (normalizedPath === '') {
        normalizedPath = 'disk:/';
      } else {
        normalizedPath = 'disk:/' + normalizedPath;
      }

      const parts = normalizedPath.split('/').filter(p => p && p !== 'disk:');
      let currentPath = 'disk:';

      for (const part of parts) {
        currentPath += '/' + part;
        const checkUrl = `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(currentPath)}`;
        const checkResponse = await httpRequest(checkUrl, {
          method: 'GET',
          headers: {
            'Authorization': `OAuth ${this.token}`,
          },
        });

        if (checkResponse.status === 404) {
          // Папка не существует, создаем
          const createUrl = `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(currentPath)}`;
          const createResponse = await httpRequest(createUrl, {
            method: 'PUT',
            headers: {
              'Authorization': `OAuth ${this.token}`,
            },
          });

          if (createResponse.status < 200 || (createResponse.status >= 300 && createResponse.status !== 409)) {
            console.error('[YandexDisk] Ошибка создания директории:', createResponse.status, createResponse.data);
            return false;
          }
        } else if (checkResponse.status < 200 || checkResponse.status >= 300) {
          console.error('[YandexDisk] Ошибка проверки директории:', checkResponse.status);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('[YandexDisk] Ошибка при создании директории:', error);
      return false;
    }
  }
}

