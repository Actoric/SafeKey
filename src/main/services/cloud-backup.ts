import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { app } from 'electron';
import { runtime } from '../runtime-context';
import { PATHS } from '../config/paths.config';
import { DatabaseService } from '../database/database';
import { ensureEncryptionInitialized } from '../encryption-init';
import { EncryptionService } from '../encryption/encryption';
import { YandexDiskService } from './yandex-disk';
import { GoogleDriveService } from './google-drive';
import { GoogleOAuthService } from './google-oauth';
import {
  loadCloudSettings,
  saveCloudSettings,
  type CloudProvider,
  type CloudSettings,
} from '../config/cloud-settings';
import {
  getMachinePassword,
  unwrapMachinePassword,
  wrapMachinePassword,
  type RecoveryPayload,
} from './cloud-recovery';

const MAX_BACKUP_VERSIONS = 7;
const LATEST_BACKUP_NAME = 'safekey_backup.dat';
const KEY_FILE_NAME = 'safekey_key.json';
const MANIFEST_FILE_NAME = 'safekey_manifest.json';
const RECOVERY_FILE_NAME = 'safekey_recovery.json';

export type CloudBackupVersion = {
  file: string;
  createdAt: string;
  size: number;
  device?: string;
  isLatest?: boolean;
};

type CloudManifest = {
  version: number;
  latest: string;
  keyFile: string;
  backups: CloudBackupVersion[];
};

export type CloudStorageProvider = {
  listFiles: () => Promise<string[]>;
  uploadFile: (localPath: string, remoteName: string) => Promise<boolean>;
  downloadFile: (remoteName: string) => Promise<Buffer | null>;
  deleteFile: (remoteName: string) => Promise<boolean>;
  fileExists: (remoteName: string) => Promise<boolean>;
};

export type SyncProgressCallback = (progress: number, message: string) => void;

export function pickBackupFileName(files: string[]): string | null {
  const backups = files.filter((f) => {
    const lower = f.toLowerCase();
    const hasExt = lower.endsWith('.dat') || lower.endsWith('.db');
    const hasBackupMarker = lower.includes('safekey_backup');
    return hasExt && hasBackupMarker;
  });
  if (backups.length === 0) return null;
  const main = backups.find((f) => f.toLowerCase() === LATEST_BACKUP_NAME);
  if (main) return main;

  const byTimestamp = [...backups].sort((a, b) => {
    const ta = Number((a.match(/(\d{10,})/) || [])[1] || 0);
    const tb = Number((b.match(/(\d{10,})/) || [])[1] || 0);
    return tb - ta;
  });
  if (byTimestamp[0]) return byTimestamp[0];
  return [...backups].sort().reverse()[0];
}

export function pickKeyFileName(files: string[]): string | null {
  if (files.includes(KEY_FILE_NAME)) return KEY_FILE_NAME;
  const legacyCandidates = ['master.key', 'safekey.key', 'safekey_key.key'];
  for (const c of legacyCandidates) {
    if (files.includes(c)) return c;
  }
  const fuzzy = files.find((f) => /key/i.test(f) && (f.endsWith('.json') || f.endsWith('.key')));
  return fuzzy ?? null;
}

function formatVersionFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `safekey_backup_${stamp}.dat`;
}

function parseVersionCreatedAt(fileName: string): string | null {
  const m = fileName.match(/safekey_backup_(\d{8})_(\d{6})\.dat/i);
  if (!m) return null;
  const d = m[1];
  const t = m[2];
  const iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isVersionedBackupName(name: string): boolean {
  return /^safekey_backup_\d{8}_\d{6}\.dat$/i.test(name);
}

async function readManifest(provider: CloudStorageProvider): Promise<CloudManifest | null> {
  try {
    const buf = await provider.downloadFile(MANIFEST_FILE_NAME);
    if (!buf || buf.length === 0) return null;
    return JSON.parse(buf.toString('utf-8')) as CloudManifest;
  } catch {
    return null;
  }
}

async function writeManifest(provider: CloudStorageProvider, manifest: CloudManifest): Promise<boolean> {
  const tempPath = path.join(app.getPath('temp'), `safekey_manifest_${process.pid}.json`);
  try {
    fs.writeFileSync(tempPath, JSON.stringify(manifest, null, 2), 'utf-8');
    return provider.uploadFile(tempPath, MANIFEST_FILE_NAME);
  } finally {
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        /* ignore */
      }
    }
  }
}

function buildVersionsFromFiles(files: string[]): CloudBackupVersion[] {
  const versioned = files.filter(isVersionedBackupName);
  const versions: CloudBackupVersion[] = versioned.map((file) => ({
    file,
    createdAt: parseVersionCreatedAt(file) || new Date(0).toISOString(),
    size: 0,
  }));
  versions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (files.some((f) => f.toLowerCase() === LATEST_BACKUP_NAME) && versions.length === 0) {
    versions.push({
      file: LATEST_BACKUP_NAME,
      createdAt: new Date().toISOString(),
      size: 0,
      isLatest: true,
    });
  }

  return versions;
}

async function ensureFreshGoogleToken(settings: CloudSettings): Promise<string | null> {
  const gd = settings.googleDrive;
  if (!gd?.token) return null;

  const expiresAt = gd.tokenExpiresAt || 0;
  const needsRefresh = !expiresAt || Date.now() > expiresAt - 60_000;
  if (!needsRefresh || !gd.refreshToken) {
    return gd.token;
  }

  try {
    const refreshed = await GoogleOAuthService.refreshAccessToken(gd.refreshToken);
    gd.token = refreshed.accessToken;
    if (refreshed.refreshToken) gd.refreshToken = refreshed.refreshToken;
    if (refreshed.expiresIn) gd.tokenExpiresAt = Date.now() + refreshed.expiresIn * 1000;
    saveCloudSettings(settings);
    return gd.token;
  } catch (error) {
    console.warn('[CloudBackup] Не удалось обновить Google токен:', error);
    return gd.token;
  }
}

function normalizeYandexPath(diskPath?: string): string {
  let p = (diskPath || 'SafeKey').trim();
  if (p.startsWith('/')) p = p.substring(1);
  return p || 'SafeKey';
}

export async function createYandexProvider(settings: CloudSettings): Promise<YandexDiskService | null> {
  if (!settings.yandexDisk?.enabled || !settings.yandexDisk.token) return null;
  return new YandexDiskService(settings.yandexDisk.token, normalizeYandexPath(settings.yandexDisk.path));
}

export async function createGoogleProvider(
  settings: CloudSettings
): Promise<{ service: GoogleDriveService; folderId: string } | null> {
  if (!settings.googleDrive?.enabled || !settings.googleDrive.token) return null;
  const token = await ensureFreshGoogleToken(settings);
  if (!token) return null;
  const service = new GoogleDriveService(token, settings.googleDrive.folderId || '');
  const folderId = await service.ensureFolder('SafeKey');
  if (folderId && folderId !== settings.googleDrive.folderId) {
    settings.googleDrive.folderId = folderId;
    saveCloudSettings(settings);
  }
  return { service, folderId };
}

function emitProgress(onProgress: SyncProgressCallback | undefined, progress: number, message: string) {
  onProgress?.(progress, message);
  if (runtime.mainWindow && !runtime.mainWindow.isDestroyed()) {
    runtime.mainWindow.webContents.send('cloud-sync-progress', { progress, message });
  }
}

async function uploadBackupPair(
  provider: CloudStorageProvider,
  label: string,
  onProgress?: SyncProgressCallback
): Promise<{ success: boolean; error?: string }> {
  const dbPath = PATHS.database();
  if (!fs.existsSync(dbPath)) {
    return { success: false, error: 'База данных не найдена' };
  }

  await ensureEncryptionInitialized();
  const now = new Date();
  const versionFileName = formatVersionFileName(now);
  const tempEncryptedPath = path.join(app.getPath('temp'), `safekey_backup_encrypted_${process.pid}.dat`);

  try {
    emitProgress(onProgress, 20, `Шифрование для ${label}…`);
    runtime.encryptionService!.encryptFile(dbPath, tempEncryptedPath);
    const size = fs.statSync(tempEncryptedPath).size;

    emitProgress(onProgress, 40, `Загрузка версии на ${label}…`);
    const versionUploaded = await provider.uploadFile(tempEncryptedPath, versionFileName);
    if (!versionUploaded) {
      return { success: false, error: `Ошибка загрузки версии бэкапа на ${label}` };
    }

    emitProgress(onProgress, 55, `Обновление актуальной копии на ${label}…`);
    const latestUploaded = await provider.uploadFile(tempEncryptedPath, LATEST_BACKUP_NAME);
    if (fs.existsSync(tempEncryptedPath)) fs.unlinkSync(tempEncryptedPath);
    if (!latestUploaded) {
      return { success: false, error: `Ошибка загрузки актуального бэкапа на ${label}` };
    }

    const keyFilePath = PATHS.masterKey();
    if (!fs.existsSync(keyFilePath)) {
      return {
        success: false,
        error: 'Файл ключа master.key не найден локально. Без него восстановление невозможно.',
      };
    }

    emitProgress(onProgress, 70, `Загрузка ключа на ${label}…`);
    const tempKeyPath = path.join(app.getPath('temp'), `${process.pid}_${KEY_FILE_NAME}`);
    fs.copyFileSync(keyFilePath, tempKeyPath);
    const keyUploaded = await provider.uploadFile(tempKeyPath, KEY_FILE_NAME);
    if (fs.existsSync(tempKeyPath)) fs.unlinkSync(tempKeyPath);

    const backupExists = await provider.fileExists(LATEST_BACKUP_NAME);
    const keyExists = await provider.fileExists(KEY_FILE_NAME);
    if (!keyUploaded || !backupExists || !keyExists) {
      return {
        success: false,
        error: `Бэкап на ${label} загружен не полностью: отсутствует ключ (${KEY_FILE_NAME}).`,
      };
    }

    emitProgress(onProgress, 82, `Обновление манифеста на ${label}…`);
    const existingFiles = await provider.listFiles();
    const previous = (await readManifest(provider))?.backups || buildVersionsFromFiles(existingFiles);
    const entry: CloudBackupVersion = {
      file: versionFileName,
      createdAt: now.toISOString(),
      size,
      device: os.hostname(),
      isLatest: true,
    };
    const backups = [
      entry,
      ...previous
        .filter((b) => b.file !== versionFileName && b.file !== LATEST_BACKUP_NAME)
        .map((b) => ({ ...b, isLatest: false })),
    ].slice(0, MAX_BACKUP_VERSIONS);

    const manifest: CloudManifest = {
      version: 1,
      latest: versionFileName,
      keyFile: KEY_FILE_NAME,
      backups,
    };
    await writeManifest(provider, manifest);

    emitProgress(onProgress, 90, `Очистка старых версий на ${label}…`);
    const keep = new Set([
      LATEST_BACKUP_NAME,
      KEY_FILE_NAME,
      MANIFEST_FILE_NAME,
      RECOVERY_FILE_NAME,
      ...backups.map((b) => b.file),
    ]);
    for (const file of existingFiles) {
      const isBackup =
        isVersionedBackupName(file) ||
        (file.toLowerCase().includes('safekey_backup') && file.toLowerCase() !== LATEST_BACKUP_NAME);
      if (isBackup && !keep.has(file)) {
        await provider.deleteFile(file);
      }
    }

    return { success: true };
  } catch (error) {
    if (fs.existsSync(tempEncryptedPath)) {
      try {
        fs.unlinkSync(tempEncryptedPath);
      } catch {
        /* ignore */
      }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    };
  }
}

export async function listCloudVersions(
  provider: CloudProvider
): Promise<{ success: boolean; versions: CloudBackupVersion[]; error?: string }> {
  try {
    const settings = loadCloudSettings();
    let storage: CloudStorageProvider | null = null;
    if (provider === 'yandex') {
      storage = await createYandexProvider(settings);
    } else {
      const google = await createGoogleProvider(settings);
      storage = google?.service || null;
    }
    if (!storage) {
      return { success: false, versions: [], error: 'Провайдер не подключён' };
    }

    const files = await storage.listFiles();
    const manifest = await readManifest(storage);
    let versions = manifest?.backups?.length ? manifest.backups : buildVersionsFromFiles(files);

    if (manifest?.latest) {
      versions = versions.map((v) => ({ ...v, isLatest: v.file === manifest.latest }));
    } else if (versions.length > 0) {
      versions = versions.map((v, i) => ({ ...v, isLatest: i === 0 }));
    }

    versions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { success: true, versions };
  } catch (error) {
    return {
      success: false,
      versions: [],
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    };
  }
}

export async function configureCloudRecovery(recoveryCode: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const code = recoveryCode.trim();
  if (code.length < 6) {
    return { success: false, error: 'Код восстановления должен быть не короче 6 символов' };
  }

  const settings = loadCloudSettings();
  const payload = wrapMachinePassword(getMachinePassword(), code);
  const tempPath = path.join(app.getPath('temp'), `safekey_recovery_${process.pid}.json`);
  const results: string[] = [];

  try {
    fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf-8');

    const yandex = await createYandexProvider(settings);
    if (yandex) {
      const ok = await yandex.uploadFile(tempPath, RECOVERY_FILE_NAME);
      if (!ok) results.push('Яндекс.Диск: ошибка загрузки');
    }

    const google = await createGoogleProvider(settings);
    if (google) {
      const ok = await google.service.uploadFile(tempPath, RECOVERY_FILE_NAME);
      if (!ok) results.push('Google Drive: ошибка загрузки');
    }

    if (!yandex && !google) {
      return { success: false, error: 'Облачное хранилище не подключено' };
    }

    settings.status = {
      ...settings.status,
      recoveryConfigured: results.length === 0 ? true : settings.status?.recoveryConfigured,
    };
    saveCloudSettings(settings);

    return {
      success: results.length === 0,
      error: results.length > 0 ? results.join('; ') : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    };
  } finally {
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        /* ignore */
      }
    }
  }
}

export async function clearCloudRecovery(): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = loadCloudSettings();
    const yandex = await createYandexProvider(settings);
    if (yandex) await yandex.deleteFile(RECOVERY_FILE_NAME);
    const google = await createGoogleProvider(settings);
    if (google) await google.service.deleteFile(RECOVERY_FILE_NAME);

    settings.status = {
      ...settings.status,
      recoveryConfigured: false,
    };
    saveCloudSettings(settings);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    };
  }
}

export type CloudStorageQuota = {
  provider: CloudProvider;
  total: number;
  used: number;
  free: number;
};

export async function getCloudStorageQuota(
  provider?: CloudProvider
): Promise<{ success: boolean; quotas: CloudStorageQuota[]; error?: string }> {
  try {
    const settings = loadCloudSettings();
    const quotas: CloudStorageQuota[] = [];
    const targets: CloudProvider[] = provider ? [provider] : ['yandex', 'google'];

    for (const p of targets) {
      if (p === 'yandex') {
        const yandex = await createYandexProvider(settings);
        if (!yandex) continue;
        const q = await yandex.getQuota();
        if (q && q.total > 0) {
          quotas.push({
            provider: 'yandex',
            total: q.total,
            used: q.used,
            free: Math.max(0, q.total - q.used),
          });
        }
      } else {
        const google = await createGoogleProvider(settings);
        if (!google) continue;
        const q = await google.service.getQuota();
        if (q && q.total > 0) {
          quotas.push({
            provider: 'google',
            total: q.total,
            used: q.used,
            free: Math.max(0, q.total - q.used),
          });
        }
      }
    }

    return { success: true, quotas };
  } catch (error) {
    return {
      success: false,
      quotas: [],
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    };
  }
}

export async function syncToCloud(onProgress?: SyncProgressCallback): Promise<{
  success: boolean;
  error?: string;
  providers?: CloudProvider[];
}> {
  if (!runtime.dbService) {
    return { success: false, error: 'Database not initialized' };
  }

  const cloudSettings = loadCloudSettings();
  const results: { provider: CloudProvider; success: boolean; error?: string }[] = [];

  emitProgress(onProgress, 5, 'Подготовка синхронизации…');

  const yandex = await createYandexProvider(cloudSettings);
  if (yandex) {
    const result = await uploadBackupPair(yandex, 'Яндекс.Диск', onProgress);
    results.push({ provider: 'yandex', ...result });
  }

  const google = await createGoogleProvider(cloudSettings);
  if (google) {
    const result = await uploadBackupPair(google.service, 'Google Drive', onProgress);
    results.push({ provider: 'google', ...result });
  }

  if (results.length === 0) {
    return { success: false, error: 'Облачное хранилище не подключено' };
  }

  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  const next: CloudSettings = {
    ...cloudSettings,
    status: {
      ...cloudSettings.status,
      lastBackupAt: succeeded.length > 0 ? new Date().toISOString() : cloudSettings.status?.lastBackupAt,
      lastError: failed.length > 0 ? failed.map((f) => `${f.provider}: ${f.error}`).join('; ') : undefined,
      lastProviders: succeeded.map((s) => s.provider),
    },
  };
  saveCloudSettings(next);

  if (succeeded.length === 0) {
    emitProgress(onProgress, 100, 'Ошибка синхронизации');
    return { success: false, error: failed.map((f) => f.error).join('; '), providers: [] };
  }

  emitProgress(onProgress, 100, 'Синхронизация завершена');
  return {
    success: true,
    error: failed.length > 0 ? failed.map((f) => f.error).join('; ') : undefined,
    providers: succeeded.map((s) => s.provider),
  };
}

export type CloudSyncCheckResult = {
  synced: boolean;
  message: string;
  files?: string[];
  isRestorable?: boolean;
  hasKeyFile?: boolean;
  backupFile?: string;
  keyFile?: string;
  provider?: CloudProvider;
  providers?: Array<{
    provider: CloudProvider;
    synced: boolean;
    isRestorable: boolean;
    message: string;
    files?: string[];
    backupFile?: string;
    keyFile?: string;
    hasKeyFile?: boolean;
  }>;
  lastBackupAt?: string;
  lastError?: string;
};

async function checkProvider(
  provider: CloudProvider,
  storage: CloudStorageProvider
): Promise<{
  provider: CloudProvider;
  synced: boolean;
  isRestorable: boolean;
  message: string;
  files?: string[];
  backupFile?: string;
  keyFile?: string;
  hasKeyFile?: boolean;
}> {
  const files = await storage.listFiles();
  const backupFiles = files.filter(
    (f) =>
      f.toLowerCase().includes('safekey_backup') &&
      (f.toLowerCase().endsWith('.dat') || f.toLowerCase().endsWith('.db'))
  );
  const backupName = pickBackupFileName(files);
  const keyName = pickKeyFileName(files);

  if (backupFiles.length > 0) {
    if (backupName && keyName) {
      return {
        provider,
        synced: true,
        isRestorable: true,
        hasKeyFile: true,
        message: `Бэкап и ключ найдены: ${backupName} + ${keyName}.`,
        backupFile: backupName,
        keyFile: keyName,
        files: backupFiles,
      };
    }
    const latestFile = backupName || [...backupFiles].sort().reverse()[0];
    return {
      provider,
      synced: true,
      isRestorable: false,
      hasKeyFile: false,
      message: `Найден бэкап (${latestFile}), но ключевой файл отсутствует.`,
      backupFile: latestFile,
      files: backupFiles,
    };
  }

  return {
    provider,
    synced: false,
    isRestorable: false,
    hasKeyFile: !!keyName,
    keyFile: keyName || undefined,
    message: 'Файлы резервных копий не найдены',
  };
}

export async function checkCloudSync(): Promise<CloudSyncCheckResult> {
  const cloudSettings = loadCloudSettings();
  const providerResults: CloudSyncCheckResult['providers'] = [];

  const yandex = await createYandexProvider(cloudSettings);
  if (yandex) {
    providerResults!.push(await checkProvider('yandex', yandex));
  }

  const google = await createGoogleProvider(cloudSettings);
  if (google) {
    providerResults!.push(await checkProvider('google', google.service));
  }

  if (!providerResults || providerResults.length === 0) {
    return {
      synced: false,
      message: 'Облачное хранилище не подключено',
      lastBackupAt: cloudSettings.status?.lastBackupAt,
      lastError: cloudSettings.status?.lastError,
    };
  }

  const anySynced = providerResults.some((p) => p.synced);
  const anyRestorable = providerResults.some((p) => p.isRestorable);
  const primary = providerResults.find((p) => p.isRestorable) || providerResults[0];

  return {
    synced: anySynced,
    isRestorable: anyRestorable,
    hasKeyFile: primary.hasKeyFile,
    backupFile: primary.backupFile,
    keyFile: primary.keyFile,
    files: primary.files,
    provider: primary.provider,
    message: providerResults.map((p) => `${p.provider}: ${p.message}`).join('\n'),
    providers: providerResults,
    lastBackupAt: cloudSettings.status?.lastBackupAt,
    lastError: cloudSettings.status?.lastError,
  };
}

export async function restoreFromCloud(
  provider: CloudProvider,
  legacyWindowsUsername?: string,
  backupFileName?: string,
  recoveryCode?: string
): Promise<{ success: boolean; error?: string }> {
  const tmp = app.getPath('temp');
  const dbPath = PATHS.database();
  const keyPath = PATHS.masterKey();
  const masterBak = path.join(tmp, `safekey_restore_master_${process.pid}.key`);
  const dbBak = path.join(tmp, `safekey_restore_db_${process.pid}.db`);
  const encTemp = path.join(tmp, `safekey_restore_enc_${process.pid}.dat`);

  const rollbackMasterKeyAndDb = () => {
    try {
      if (fs.existsSync(masterBak)) {
        fs.copyFileSync(masterBak, keyPath);
        fs.unlinkSync(masterBak);
      } else if (fs.existsSync(keyPath)) {
        fs.unlinkSync(keyPath);
      }
      if (fs.existsSync(dbBak)) {
        fs.copyFileSync(dbBak, dbPath);
        fs.unlinkSync(dbBak);
      }
    } catch (e) {
      console.error('[CloudRestore] Ошибка отката файлов:', e);
    }
  };

  try {
    const cloudSettings = loadCloudSettings();
    let storage: CloudStorageProvider | null = null;

    if (provider === 'yandex') {
      storage = await createYandexProvider(cloudSettings);
      if (!storage) return { success: false, error: 'Яндекс.Диск не подключён' };
    } else {
      const google = await createGoogleProvider(cloudSettings);
      if (!google) return { success: false, error: 'Google Drive не подключён' };
      storage = google.service;
    }

    const remoteFiles = await storage.listFiles();
    const backupName =
      (backupFileName && remoteFiles.includes(backupFileName) && backupFileName) ||
      pickBackupFileName(remoteFiles);
    if (!backupName) {
      return { success: false, error: 'На диске нет файла резервной копии (safekey_backup*.dat)' };
    }

    const keyName = pickKeyFileName(remoteFiles);
    if (!keyName) {
      return {
        success: false,
        error:
          'В облаке нет ключевого файла (safekey_key.json / master.key). Без него нельзя расшифровать бэкап.',
      };
    }

    const keyBuf = await storage.downloadFile(keyName);
    if (!keyBuf || keyBuf.length === 0) {
      return { success: false, error: `Не удалось скачать ключевой файл (${keyName}).` };
    }

    const backupBuf = await storage.downloadFile(backupName);
    if (!backupBuf || backupBuf.length === 0) {
      return { success: false, error: `Не удалось скачать ${backupName}` };
    }

    if (fs.existsSync(keyPath)) fs.copyFileSync(keyPath, masterBak);
    if (fs.existsSync(dbPath)) fs.copyFileSync(dbPath, dbBak);

    runtime.dbService?.close();
    runtime.dbService = null;

    fs.writeFileSync(keyPath, keyBuf);

    const enc = new EncryptionService();
    let machinePassword = getMachinePassword(legacyWindowsUsername);
    let keyOk = await enc.restoreMasterKey(machinePassword);

    if (!keyOk && recoveryCode?.trim()) {
      try {
        const recoveryBuf = await storage.downloadFile(RECOVERY_FILE_NAME);
        if (recoveryBuf && recoveryBuf.length > 0) {
          const payload = JSON.parse(recoveryBuf.toString('utf-8')) as RecoveryPayload;
          const unwrapped = unwrapMachinePassword(payload, recoveryCode.trim());
          if (unwrapped) {
            machinePassword = unwrapped;
            keyOk = await enc.restoreMasterKey(machinePassword);
          }
        }
      } catch (recoveryErr) {
        console.warn('[CloudRestore] Ошибка recovery-файла:', recoveryErr);
      }
    }

    if (!keyOk) {
      rollbackMasterKeyAndDb();
      return {
        success: false,
        error: recoveryCode?.trim()
          ? 'Код восстановления не подошёл, либо файл recovery отсутствует в облаке.'
          : 'Ключ не подошёл к резервной копии. Укажите старое имя Windows в «Дополнительно» или код восстановления.',
      };
    }

    if (backupName.endsWith('.dat')) {
      fs.writeFileSync(encTemp, backupBuf);
      try {
        enc.decryptFile(encTemp, dbPath);
      } catch (decErr) {
        console.error('[CloudRestore] Ошибка расшифровки:', decErr);
        rollbackMasterKeyAndDb();
        return {
          success: false,
          error: 'Не удалось расшифровать резервную копию (неверный ключ или повреждённый файл)',
        };
      } finally {
        if (fs.existsSync(encTemp)) fs.unlinkSync(encTemp);
      }
    } else {
      fs.writeFileSync(dbPath, backupBuf);
    }

    runtime.encryptionService = enc;
    const newDb = new DatabaseService(dbPath);
    await newDb.initialize();
    runtime.dbService = newDb;

    try {
      if (fs.existsSync(masterBak)) fs.unlinkSync(masterBak);
      if (fs.existsSync(dbBak)) fs.unlinkSync(dbBak);
    } catch {
      /* ignore */
    }

    console.log(`[CloudRestore] База восстановлена из ${provider} (${backupName})`);
    return { success: true };
  } catch (error) {
    rollbackMasterKeyAndDb();
    const msg = error instanceof Error ? error.message : 'Неизвестная ошибка';
    console.error('[CloudRestore]', error);
    return { success: false, error: msg };
  }
}
