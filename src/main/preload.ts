import { contextBridge, ipcRenderer } from 'electron';

// Типы определены локально для preload, так как shared типы могут быть недоступны
interface CreatePasswordEntryRequest {
  title: string;
  category_id?: number | null;
  data: {
    service: string;
    login: string;
    password: string;
    url?: string;
    notes?: string;
  };
}

interface UpdatePasswordEntryRequest {
  title?: string;
  category_id?: number | null;
  data?: {
    service: string;
    login: string;
    password: string;
    url?: string;
    notes?: string;
  };
}

const electronAPI = {
  initDatabase: (dbPath: string) => ipcRenderer.invoke('init-database', dbPath),
  initEncryption: () => ipcRenderer.invoke('init-encryption'),
  verifyWindowsPin: () => ipcRenderer.invoke('verify-windows-pin'),
  checkWindowsPinAvailable: () => ipcRenderer.invoke('check-windows-pin-available'),
  createPasswordEntry: (entry: CreatePasswordEntryRequest) =>
    ipcRenderer.invoke('create-password-entry', entry),
  getPasswordEntries: () => ipcRenderer.invoke('get-password-entries'),
  updatePasswordEntry: (id: number, entry: UpdatePasswordEntryRequest) =>
    ipcRenderer.invoke('update-password-entry', id, entry),
  deletePasswordEntry: (id: number) =>
    ipcRenderer.invoke('delete-password-entry', id),
  searchPasswords: (query: string) =>
    ipcRenderer.invoke('search-passwords', query),
  toggleFavorite: (id: number) => ipcRenderer.invoke('toggle-favorite', id),
  getFavoritePasswords: () => ipcRenderer.invoke('get-favorite-passwords'),
  createCategory: (name: string, parentId?: number | null) =>
    ipcRenderer.invoke('create-category', name, parentId),
  getCategories: () => ipcRenderer.invoke('get-categories'),
  updateCategory: (id: number, name: string) =>
    ipcRenderer.invoke('update-category', id, name),
  deleteCategory: (id: number) => ipcRenderer.invoke('delete-category', id),
  getPasswordsByCategory: (categoryId: number | null) =>
    ipcRenderer.invoke('get-passwords-by-category', categoryId),
  getCloudSettings: () => ipcRenderer.invoke('get-cloud-settings'),
  saveCloudSettings: (settings: any) =>
    ipcRenderer.invoke('save-cloud-settings', settings),
  authorizeYandexDisk: () => ipcRenderer.invoke('authorize-yandex-disk'),
  syncToCloud: () => ipcRenderer.invoke('sync-to-cloud'),
  checkCloudSync: () => ipcRenderer.invoke('check-cloud-sync'),
  getWindowsUsername: () => ipcRenderer.invoke('get-windows-username'),
  // Управление окном
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  // Резервные коды
  createBackupCodeEntry: (entry: any) =>
    ipcRenderer.invoke('create-backup-code-entry', entry),
  getBackupCodeEntries: () => ipcRenderer.invoke('get-backup-code-entries'),
  getBackupCodeEntryById: (id: number) =>
    ipcRenderer.invoke('get-backup-code-entry-by-id', id),
  updateBackupCodeEntry: (id: number, entry: any) =>
    ipcRenderer.invoke('update-backup-code-entry', id, entry),
  deleteBackupCodeEntry: (id: number) =>
    ipcRenderer.invoke('delete-backup-code-entry', id),
  decryptBackupCodeEntry: (entry: any) =>
    ipcRenderer.invoke('decrypt-backup-code-entry', entry),
  // Security Questions
  createSecurityQuestionEntry: (entry: any) =>
    ipcRenderer.invoke('create-security-question-entry', entry),
  getSecurityQuestionEntries: () => ipcRenderer.invoke('get-security-question-entries'),
  getSecurityQuestionEntryById: (id: number) =>
    ipcRenderer.invoke('get-security-question-entry-by-id', id),
  updateSecurityQuestionEntry: (id: number, entry: any) =>
    ipcRenderer.invoke('update-security-question-entry', id, entry),
  deleteSecurityQuestionEntry: (id: number) =>
    ipcRenderer.invoke('delete-security-question-entry', id),
  decryptSecurityQuestionEntry: (entry: any) =>
    ipcRenderer.invoke('decrypt-security-question-entry', entry),
  // Auto Updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  // App Settings
  getAppSettings: () => ipcRenderer.invoke('get-app-settings'),
  saveAppSettings: (settings: any) => ipcRenderer.invoke('save-app-settings', settings),
  // Overlay
  openOverlay: () => ipcRenderer.invoke('open-overlay'),
  // Clipboard
  copyToClipboard: (text: string) => ipcRenderer.invoke('copy-to-clipboard', text),
  // URL
  openUrl: (url: string) => ipcRenderer.invoke('open-url', url),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
