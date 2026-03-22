/**
 * Мост API для мобильного приложения — совместим с интерфейсом electronAPI десктопа.
 * Использует sql.js (БД), encryption-browser (шифрование), Preferences (настройки).
 */
import { Preferences } from '@capacitor/preferences';
import { Clipboard } from '@capacitor/clipboard';
import { Browser } from '@capacitor/browser';
import * as enc from '../lib/encryption-browser';
import * as db from '../lib/db-sqljs';
import {
  downloadYandexBackup,
  downloadYandexKeyFile,
  uploadYandexBackup,
  getYandexAuthUrlMobile,
  exchangeYandexCodeForToken,
  listYandexFiles,
} from '../lib/yandex-cloud-browser';
import type {
  CloudSettings,
  AppSettings,
  CreatePasswordEntryRequest,
  UpdatePasswordEntryRequest,
  DatabasePasswordEntry,
  DatabaseBackupCodeEntry,
  DatabaseSecurityQuestionEntry,
  BackupCodeEntryData,
  SecurityQuestionEntryData,
  CreateBackupCodeEntryRequest,
  UpdateBackupCodeEntryRequest,
  CreateSecurityQuestionEntryRequest,
  UpdateSecurityQuestionEntryRequest,
} from '../types';

const PREFS_CLOUD = 'safekey_cloud_settings';
const PREFS_APP = 'safekey_app_settings';
const PREFS_KEY_DATA = 'safekey_key_data';

let authStatus = false;

async function getCloudSettings(): Promise<CloudSettings> {
  const { value } = await Preferences.get({ key: PREFS_CLOUD });
  if (value) try { return JSON.parse(value) as CloudSettings; } catch { /* ignore */ }
  return {
    yandexDisk: { enabled: false, token: '', path: 'SafeKey' },
    googleDrive: { enabled: false, token: '', folderId: '' },
  };
}

async function saveCloudSettings(settings: CloudSettings): Promise<void> {
  await Preferences.set({ key: PREFS_CLOUD, value: JSON.stringify(settings) });
}

async function getAppSettings(): Promise<AppSettings> {
  const { value } = await Preferences.get({ key: PREFS_APP });
  if (value) try { return JSON.parse(value) as AppSettings; } catch { /* ignore */ }
  return { language: 'ru', theme: 'light' };
}

async function saveAppSettings(settings: AppSettings): Promise<void> {
  await Preferences.set({ key: PREFS_APP, value: JSON.stringify(settings) });
}

function encryptData(data: object): string {
  return enc.encrypt(JSON.stringify(data));
}

function decryptData<T>(encrypted: string): T {
  return JSON.parse(enc.decrypt(encrypted)) as T;
}

export const mobileAPI = {
  async initSqlJs(): Promise<void> {
    await db.initSqlJsLib();
  },

  async restoreFromCloud(code: string): Promise<
    | { success: true; keyData: { salt: string; keyHash: string }; backupText: string }
    | { success: false; error: string }
  > {
    const token = await exchangeYandexCodeForToken(code);
    if (!token) return { success: false, error: 'Не удалось получить токен' };
    const keyData = await downloadYandexKeyFile(token);
    if (!keyData) return { success: false, error: 'В облаке нет ключевого файла. Сначала выполните синхронизацию с десктопа.' };
    const backupText = await downloadYandexBackup(token);
    if (!backupText) return { success: false, error: 'Не удалось скачать резервную копию' };
    await saveCloudSettings({
      yandexDisk: { enabled: true, token, path: 'SafeKey' },
      googleDrive: { enabled: false },
    });
    return { success: true, keyData, backupText };
  },

  async verifyAndLoadDb(password: string, keyData: { salt: string; keyHash: string }, backupText: string): Promise<boolean> {
    if (!enc.setMasterKeyFromKeyData(password, keyData)) return false;
    try {
      const buffer = enc.decryptFileFromString(backupText);
      await db.initSqlJsLib();
      db.initDbFromBuffer(buffer);
      authStatus = true;
      await Preferences.set({ key: PREFS_KEY_DATA, value: JSON.stringify(keyData) });
      return true;
    } catch {
      return false;
    }
  },

  async createNewVault(password: string): Promise<boolean> {
    const keyData = enc.createKeyFromPassword(password);
    await db.initSqlJsLib();
    db.initDbEmpty();
    enc.setMasterKeyFromKeyData(password, keyData);
    await Preferences.set({ key: PREFS_KEY_DATA, value: JSON.stringify(keyData) });
    authStatus = true;
    return true;
  },

  async tryUnlockWithStoredKey(password: string): Promise<boolean> {
    const { value } = await Preferences.get({ key: PREFS_KEY_DATA });
    if (!value) return false;
    try {
      const keyData = JSON.parse(value) as { salt: string; keyHash: string };
      if (!enc.setMasterKeyFromKeyData(password, keyData)) return false;
      if (!db.isDbOpen()) return false;
      authStatus = true;
      return true;
    } catch {
      return false;
    }
  },

  hasStoredKeyData(): Promise<boolean> {
    return Preferences.get({ key: PREFS_KEY_DATA }).then(({ value }) => !!value);
  },

  isDbOpen(): boolean {
    return db.isDbOpen();
  },

  logout(): void {
    authStatus = false;
    enc.clearMasterKey();
  },

  // ——— API, совместимое с десктопом ———

  async initEncryption(): Promise<{ success: boolean }> {
    return { success: true };
  },

  async checkMasterPasswordInitialized(): Promise<boolean> {
    return (await Preferences.get({ key: PREFS_KEY_DATA })).value != null;
  },

  async verifyMasterPassword(password: string): Promise<boolean> {
    return this.tryUnlockWithStoredKey(password);
  },

  async setMasterPassword(_password: string): Promise<{ success: boolean }> {
    return { success: true };
  },

  async getPasswordEntries(): Promise<(DatabasePasswordEntry & { data: import('../types').PasswordEntryData })[]> {
    const rows = db.getAllPasswordEntries();
    return rows.map((row) => ({
      ...row,
      data: decryptData(row.encrypted_data),
    })) as (DatabasePasswordEntry & { data: import('../types').PasswordEntryData })[];
  },

  async getPasswordsByCategory(categoryId: number | null): Promise<(DatabasePasswordEntry & { data: import('../types').PasswordEntryData })[]> {
    const rows = db.getPasswordEntriesByCategory(categoryId);
    return rows.map((row) => ({
      ...row,
      data: decryptData(row.encrypted_data),
    })) as (DatabasePasswordEntry & { data: import('../types').PasswordEntryData })[];
  },

  async createPasswordEntry(entry: CreatePasswordEntryRequest): Promise<DatabasePasswordEntry & { data: import('../types').PasswordEntryData }> {
    const encrypted = encryptData(entry.data);
    const row = db.createPasswordEntry(
      encrypted,
      entry.title,
      entry.category_id,
      entry.bound_app ?? null
    );
    return { ...row, data: entry.data } as DatabasePasswordEntry & { data: import('../types').PasswordEntryData };
  },

  async updatePasswordEntry(id: number, entry: UpdatePasswordEntryRequest): Promise<DatabasePasswordEntry & { data: import('../types').PasswordEntryData }> {
    const current = db.getPasswordEntryById(id);
    if (!current) throw new Error('Entry not found');
    const data = entry.data ? encryptData(entry.data) : current.encrypted_data;
    const title = entry.title ?? current.title;
    const row = db.updatePasswordEntry(id, data, title, entry.category_id, entry.bound_app);
    const decrypted = entry.data ?? decryptData<import('../types').PasswordEntryData>(row!.encrypted_data);
    return { ...row, data: decrypted } as DatabasePasswordEntry & { data: import('../types').PasswordEntryData };
  },

  async deletePasswordEntry(id: number): Promise<boolean> {
    return db.deletePasswordEntry(id);
  },

  async searchPasswords(query: string): Promise<(DatabasePasswordEntry & { data: import('../types').PasswordEntryData })[]> {
    const rows = db.searchPasswordEntries(query);
    return rows.map((row) => ({
      ...row,
      data: decryptData(row.encrypted_data),
    })) as (DatabasePasswordEntry & { data: import('../types').PasswordEntryData })[];
  },

  async toggleFavorite(id: number): Promise<(DatabasePasswordEntry & { data: import('../types').PasswordEntryData }) | null> {
    const row = db.toggleFavorite(id);
    if (!row) return null;
    return { ...row, data: decryptData(row.encrypted_data) } as DatabasePasswordEntry & { data: import('../types').PasswordEntryData };
  },

  async getFavoritePasswords(): Promise<(DatabasePasswordEntry & { data: import('../types').PasswordEntryData })[]> {
    const rows = db.getFavoritePasswordEntries();
    return rows.map((row) => ({
      ...row,
      data: decryptData(row.encrypted_data),
    })) as (DatabasePasswordEntry & { data: import('../types').PasswordEntryData })[];
  },

  async getCategories(): Promise<{ id: number; name: string; parent_id: number | null; level: number; created_at: string }[]> {
    return db.getAllCategories();
  },

  async createCategory(name: string, parentId?: number | null): Promise<{ id: number; name: string; parent_id: number | null; level: number; created_at: string }> {
    return db.createCategory(name, parentId);
  },

  async updateCategory(id: number, name: string): Promise<{ id: number; name: string; parent_id: number | null; level: number; created_at: string } | null> {
    return db.updateCategory(id, name);
  },

  async deleteCategory(id: number): Promise<boolean> {
    return db.deleteCategory(id);
  },

  async updatePasswordEntryBoundApp(id: number, boundApp: string | null): Promise<(DatabasePasswordEntry & { data: import('../types').PasswordEntryData }) | null> {
    const row = db.updatePasswordEntryBoundApp(id, boundApp);
    if (!row) return null;
    return { ...row, data: decryptData(row.encrypted_data) } as DatabasePasswordEntry & { data: import('../types').PasswordEntryData };
  },

  async getCloudSettings(): Promise<CloudSettings> {
    return getCloudSettings();
  },

  async saveCloudSettings(settings: CloudSettings): Promise<void> {
    return saveCloudSettings(settings);
  },

  async syncToCloud(): Promise<boolean> {
    const cloud = await getCloudSettings();
    if (!cloud.yandexDisk?.enabled || !cloud.yandexDisk.token) return false;
    if (!enc.hasMasterKey()) return false;
    const buffer = db.exportDbToBuffer();
    const base64 = btoa(String.fromCharCode(...buffer));
    const encrypted = enc.encrypt(base64);
    const ok = await uploadYandexBackup(cloud.yandexDisk.token, encrypted, cloud.yandexDisk.path);
    return ok;
  },

  async openYandexOAuth(): Promise<void> {
    const url = getYandexAuthUrlMobile();
    await Browser.open({ url });
  },

  async authorizeYandexDisk(): Promise<{ success: boolean; token?: string; hasExistingFiles?: boolean; files?: string[] }> {
    await this.openYandexOAuth();
    return { success: true };
  },

  async checkCloudSync(): Promise<{ synced: boolean; message: string; files?: string[] }> {
    const cloud = await getCloudSettings();
    if (!cloud.yandexDisk?.enabled || !cloud.yandexDisk.token) {
      return { synced: false, message: 'Облако не подключено' };
    }
    const files = await listYandexFiles(cloud.yandexDisk.token, cloud.yandexDisk.path);
    const hasBackup = files.some((f) => f === 'safekey_backup.dat');
    return { synced: hasBackup, message: hasBackup ? 'Синхронизировано' : 'Нет резервной копии', files };
  },

  async getAppSettings(): Promise<AppSettings> {
    return getAppSettings();
  },

  async saveAppSettings(settings: AppSettings): Promise<void> {
    return saveAppSettings(settings);
  },

  async getAppVersion(): Promise<string> {
    return '1.2.2';
  },

  async copyToClipboard(text: string): Promise<void> {
    await Clipboard.write({ string: text });
  },

  async openUrl(url: string): Promise<void> {
    await Browser.open({ url });
  },

  async checkAuthStatus(): Promise<boolean> {
    return authStatus;
  },

  async setAuthStatus(status: boolean): Promise<void> {
    authStatus = status;
  },

  async resetAuthStatus(): Promise<void> {
    authStatus = false;
  },

  // Backup codes
  async getBackupCodeEntries(): Promise<DatabaseBackupCodeEntry[]> {
    return db.getAllBackupCodeEntries() as unknown as DatabaseBackupCodeEntry[];
  },

  async getBackupCodeEntryById(id: number): Promise<DatabaseBackupCodeEntry> {
    const row = db.getBackupCodeEntryById(id);
    if (!row) throw new Error('Not found');
    return row as unknown as DatabaseBackupCodeEntry;
  },

  async createBackupCodeEntry(entry: CreateBackupCodeEntryRequest): Promise<DatabaseBackupCodeEntry> {
    const data: BackupCodeEntryData = {
      title: entry.title,
      codes: entry.codes.map((code) => ({ code, used: false })),
    };
    const row = db.createBackupCodeEntry(encryptData(data), entry.title);
    return row as unknown as DatabaseBackupCodeEntry;
  },

  async updateBackupCodeEntry(id: number, entry: UpdateBackupCodeEntryRequest): Promise<DatabaseBackupCodeEntry> {
    const current = db.getBackupCodeEntryById(id);
    if (!current) throw new Error('Not found');
    const decrypted = decryptData<BackupCodeEntryData>(current.encrypted_data);
    if (entry.title !== undefined) decrypted.title = entry.title;
    if (entry.codes !== undefined) decrypted.codes = entry.codes;
    const row = db.updateBackupCodeEntry(id, encryptData(decrypted), decrypted.title);
    return row as unknown as DatabaseBackupCodeEntry;
  },

  async deleteBackupCodeEntry(id: number): Promise<boolean> {
    return db.deleteBackupCodeEntry(id);
  },

  async decryptBackupCodeEntry(entry: DatabaseBackupCodeEntry): Promise<BackupCodeEntryData> {
    return decryptData<BackupCodeEntryData>(entry.encrypted_data);
  },

  // Security questions
  async getSecurityQuestionEntries(): Promise<DatabaseSecurityQuestionEntry[]> {
    return db.getAllSecurityQuestionEntries() as unknown as DatabaseSecurityQuestionEntry[];
  },

  async getSecurityQuestionEntryById(id: number): Promise<DatabaseSecurityQuestionEntry> {
    const row = db.getSecurityQuestionEntryById(id);
    if (!row) throw new Error('Not found');
    return row as unknown as DatabaseSecurityQuestionEntry;
  },

  async createSecurityQuestionEntry(entry: CreateSecurityQuestionEntryRequest): Promise<DatabaseSecurityQuestionEntry> {
    const data: SecurityQuestionEntryData = { title: entry.title, questions: entry.questions };
    const row = db.createSecurityQuestionEntry(encryptData(data), entry.title);
    return row as unknown as DatabaseSecurityQuestionEntry;
  },

  async updateSecurityQuestionEntry(id: number, entry: UpdateSecurityQuestionEntryRequest): Promise<DatabaseSecurityQuestionEntry> {
    const current = db.getSecurityQuestionEntryById(id);
    if (!current) throw new Error('Not found');
    const decrypted = decryptData<SecurityQuestionEntryData>(current.encrypted_data);
    if (entry.title !== undefined) decrypted.title = entry.title;
    if (entry.questions !== undefined) decrypted.questions = entry.questions;
    const row = db.updateSecurityQuestionEntry(id, encryptData(decrypted), decrypted.title);
    return row as unknown as DatabaseSecurityQuestionEntry;
  },

  async deleteSecurityQuestionEntry(id: number): Promise<boolean> {
    return db.deleteSecurityQuestionEntry(id);
  },

  async decryptSecurityQuestionEntry(entry: DatabaseSecurityQuestionEntry): Promise<SecurityQuestionEntryData> {
    return decryptData<SecurityQuestionEntryData>(entry.encrypted_data);
  },

  // Stubs (не используются на мобильном или заглушки)
  async initDatabase(_dbPath: string): Promise<{ success: boolean }> {
    return { success: true };
  },
  async showDeleteCategoryDialog(): Promise<boolean> {
    return true;
  },
  async showDeleteSecurityQuestionDialog(): Promise<boolean> {
    return true;
  },
  async showDeleteBackupCodeDialog(): Promise<boolean> {
    return true;
  },
  async getWindowsUsername(): Promise<string> {
    return 'Пользователь';
  },
  async getActiveApp(): Promise<string | null> {
    return null;
  },
  async getRunningApps(): Promise<string[]> {
    return [];
  },
  async selectExeFile(): Promise<string | null> {
    return null;
  },
  async openOverlay(): Promise<void> {},
  async minimize(): Promise<void> {},
  async maximize(): Promise<void> {},
  async close(): Promise<void> {},
  async checkForUpdates(): Promise<{ success: boolean; message?: string }> {
    return { success: false };
  },
  async downloadUpdate(): Promise<void> {},
  async installUpdate(): Promise<void> {},
  async verifyWindowsPin(): Promise<boolean> {
    return false;
  },
  async checkWindowsPinAvailable(): Promise<boolean> {
    return false;
  },
  async setAppPin(): Promise<{ success: boolean }> {
    return { success: false };
  },
  async verifyAppPin(): Promise<boolean> {
    return false;
  },
  async checkAppPinSet(): Promise<boolean> {
    return false;
  },
  async clearAppPin(): Promise<{ success: boolean }> {
    return { success: false };
  },
};

declare global {
  interface Window {
    electronAPI: typeof mobileAPI;
  }
}

export function installMobileAPI(): void {
  window.electronAPI = mobileAPI;
}
