import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';

interface DriveFile {
  id: string;
  name: string;
  mimeType?: string;
  modifiedTime?: string;
}

function httpRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: Buffer | string;
  } = {}
): Promise<{ status: number; data: Buffer; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const req = httpModule.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode || 500,
            data: Buffer.concat(chunks),
            headers: res.headers,
          });
        });
      }
    );

    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Клиент Google Drive API (scope drive.file).
 */
export class GoogleDriveService {
  private token: string;
  private folderId: string;

  constructor(token: string, folderId: string = '') {
    this.token = token;
    this.folderId = folderId;
  }

  getFolderId(): string {
    return this.folderId;
  }

  /** Найти или создать папку SafeKey; возвращает folderId. */
  async ensureFolder(folderName: string = 'SafeKey'): Promise<string> {
    if (this.folderId) {
      const exists = await this.folderExists(this.folderId);
      if (exists) return this.folderId;
    }

    const existing = await this.findFolderByName(folderName);
    if (existing) {
      this.folderId = existing;
      return existing;
    }

    const created = await this.createFolder(folderName);
    if (!created) {
      throw new Error('Не удалось создать папку SafeKey на Google Drive');
    }
    this.folderId = created;
    return created;
  }

  async listFiles(): Promise<string[]> {
    const files = await this.listFileMeta();
    return files.map((f) => f.name);
  }

  async listFileMeta(): Promise<DriveFile[]> {
    await this.ensureFolder();
    const q = `'${this.folderId}' in parents and trashed=false`;
    const url =
      `https://www.googleapis.com/drive/v3/files?` +
      `q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,modifiedTime)&pageSize=100`;

    const response = await httpRequest(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.token}` },
    });

    if (response.status < 200 || response.status >= 300) {
      console.error('[GoogleDrive] listFiles error:', response.status, response.data.toString());
      return [];
    }

    const data = JSON.parse(response.data.toString()) as { files?: DriveFile[] };
    return data.files || [];
  }

  async fileExists(remoteFileName: string): Promise<boolean> {
    const id = await this.findFileId(remoteFileName);
    return !!id;
  }

  /** Квота Google Drive: total / used в байтах. */
  async getQuota(): Promise<{ total: number; used: number } | null> {
    try {
      const url =
        'https://www.googleapis.com/drive/v3/about?fields=storageQuota';
      const response = await httpRequest(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (response.status < 200 || response.status >= 300) {
        console.error('[GoogleDrive] getQuota error:', response.status, response.data.toString());
        return null;
      }
      const data = JSON.parse(response.data.toString()) as {
        storageQuota?: { limit?: string; usage?: string; usageInDrive?: string };
      };
      const q = data.storageQuota;
      if (!q?.limit || !q.usage) return null;
      return {
        total: Number(q.limit),
        used: Number(q.usage),
      };
    } catch (error) {
      console.error('[GoogleDrive] getQuota error:', error);
      return null;
    }
  }

  async uploadFile(localFilePath: string, remoteFileName: string): Promise<boolean> {
    try {
      await this.ensureFolder();
      const content = fs.readFileSync(localFilePath);
      const existingId = await this.findFileId(remoteFileName);

      if (existingId) {
        return this.updateFileContent(existingId, remoteFileName, content);
      }
      return this.createFile(remoteFileName, content);
    } catch (error) {
      console.error('[GoogleDrive] uploadFile error:', error);
      return false;
    }
  }

  async downloadFile(remoteFileName: string): Promise<Buffer | null> {
    try {
      const fileId = await this.findFileId(remoteFileName);
      if (!fileId) {
        console.error('[GoogleDrive] Файл не найден:', remoteFileName);
        return null;
      }

      const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const response = await httpRequest(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.token}` },
      });

      if (response.status < 200 || response.status >= 300) {
        console.error('[GoogleDrive] download error:', response.status);
        return null;
      }
      return response.data;
    } catch (error) {
      console.error('[GoogleDrive] downloadFile error:', error);
      return null;
    }
  }

  async deleteFile(remoteFileName: string): Promise<boolean> {
    try {
      const fileId = await this.findFileId(remoteFileName);
      if (!fileId) return true;

      const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
      const response = await httpRequest(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.token}` },
      });
      return response.status === 204 || response.status === 200 || response.status === 404;
    } catch (error) {
      console.error('[GoogleDrive] deleteFile error:', error);
      return false;
    }
  }

  private async findFileId(name: string): Promise<string | null> {
    await this.ensureFolder();
    const q = `'${this.folderId}' in parents and name='${name.replace(/'/g, "\\'")}' and trashed=false`;
    const url =
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`;
    const response = await httpRequest(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (response.status < 200 || response.status >= 300) return null;
    const data = JSON.parse(response.data.toString()) as { files?: DriveFile[] };
    return data.files?.[0]?.id || null;
  }

  private async findFolderByName(name: string): Promise<string | null> {
    const q =
      `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const url =
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`;
    const response = await httpRequest(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (response.status < 200 || response.status >= 300) return null;
    const data = JSON.parse(response.data.toString()) as { files?: DriveFile[] };
    return data.files?.[0]?.id || null;
  }

  private async folderExists(folderId: string): Promise<boolean> {
    const url = `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,trashed`;
    const response = await httpRequest(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (response.status < 200 || response.status >= 300) return false;
    const data = JSON.parse(response.data.toString()) as { id?: string; trashed?: boolean };
    return !!data.id && !data.trashed;
  }

  private async createFolder(name: string): Promise<string | null> {
    const metadata = JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
    });
    const response = await httpRequest('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'Content-Length': String(Buffer.byteLength(metadata)),
      },
      body: metadata,
    });
    if (response.status < 200 || response.status >= 300) {
      console.error('[GoogleDrive] createFolder error:', response.status, response.data.toString());
      return null;
    }
    const data = JSON.parse(response.data.toString()) as { id?: string };
    return data.id || null;
  }

  private async createFile(name: string, content: Buffer): Promise<boolean> {
    const boundary = 'safekey_boundary_' + Date.now();
    const metadata = JSON.stringify({
      name,
      parents: [this.folderId],
    });

    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
          `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`
      ),
      content,
      Buffer.from(`\r\n--${boundary}--`),
    ]);

    const response = await httpRequest(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': String(body.length),
        },
        body,
      }
    );

    if (response.status < 200 || response.status >= 300) {
      console.error('[GoogleDrive] createFile error:', response.status, response.data.toString());
      return false;
    }
    console.log('[GoogleDrive] Файл загружен:', name);
    return true;
  }

  private async updateFileContent(fileId: string, name: string, content: Buffer): Promise<boolean> {
    const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
    const response = await httpRequest(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(content.length),
      },
      body: content,
    });

    if (response.status < 200 || response.status >= 300) {
      console.error('[GoogleDrive] updateFile error:', response.status, response.data.toString());
      return false;
    }
    console.log('[GoogleDrive] Файл обновлён:', name);
    return true;
  }
}
