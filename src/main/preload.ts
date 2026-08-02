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
  updatePasswordEntryBoundApp: (id: number, boundApp: string | null) =>
    ipcRenderer.invoke('update-password-entry-bound-app', id, boundApp),
  getActiveApp: () => ipcRenderer.invoke('get-active-app'),
  getRunningApps: () => ipcRenderer.invoke('get-running-apps'),
  selectExeFile: () => ipcRenderer.invoke('select-exe-file'),
  deleteCategory: (id: number) => ipcRenderer.invoke('delete-category', id),
  showDeleteCategoryDialog: (categoryName: string, hasChildren: boolean) => 
    ipcRenderer.invoke('show-delete-category-dialog', categoryName, hasChildren),
  showDeleteSecurityQuestionDialog: (entryTitle: string) => 
    ipcRenderer.invoke('show-delete-security-question-dialog', entryTitle),
  showDeleteBackupCodeDialog: (codeText: string, isEntry?: boolean) => 
    ipcRenderer.invoke('show-delete-backup-code-dialog', codeText, isEntry),
  getPasswordsByCategory: (categoryId: number | null) =>
    ipcRenderer.invoke('get-passwords-by-category', categoryId),
  getCloudSettings: () => ipcRenderer.invoke('get-cloud-settings'),
  saveCloudSettings: (settings: any) =>
    ipcRenderer.invoke('save-cloud-settings', settings),
  authorizeYandexDisk: () => ipcRenderer.invoke('authorize-yandex-disk'),
  authorizeGoogleDrive: () => ipcRenderer.invoke('authorize-google-drive'),
  disconnectCloudProvider: (provider: 'yandex' | 'google') =>
    ipcRenderer.invoke('disconnect-cloud-provider', provider),
  syncToCloud: () => ipcRenderer.invoke('sync-to-cloud'),
  restoreFromCloud: (provider?: 'yandex' | 'google', legacyWindowsUsername?: string, backupFileName?: string, recoveryCode?: string) =>
    ipcRenderer.invoke('restore-from-cloud', provider || 'yandex', legacyWindowsUsername, backupFileName, recoveryCode),
  restoreFromYandexDisk: (legacyWindowsUsername?: string) =>
    ipcRenderer.invoke('restore-from-yandex-disk', legacyWindowsUsername),
  listCloudVersions: (provider?: 'yandex' | 'google') =>
    ipcRenderer.invoke('list-cloud-versions', provider || 'yandex'),
  getCloudStorageQuota: (provider?: 'yandex' | 'google') =>
    ipcRenderer.invoke('get-cloud-storage-quota', provider),
  configureCloudRecovery: (recoveryCode: string) =>
    ipcRenderer.invoke('configure-cloud-recovery', recoveryCode),
  clearCloudRecovery: () => ipcRenderer.invoke('clear-cloud-recovery'),
  checkCloudSync: () => ipcRenderer.invoke('check-cloud-sync'),
  getWindowsUsername: () => ipcRenderer.invoke('get-windows-username'),
  setAppPin: (pin: string) => ipcRenderer.invoke('set-app-pin', pin),
  verifyAppPin: (pin: string) => ipcRenderer.invoke('verify-app-pin', pin),
  checkAppPinSet: () => ipcRenderer.invoke('check-app-pin-set'),
  clearAppPin: () => ipcRenderer.invoke('clear-app-pin'),
  checkAuthStatus: () => ipcRenderer.invoke('check-auth-status'),
  resetAuthStatus: () => ipcRenderer.invoke('reset-auth-status'),
  setAuthStatus: (status: boolean) => ipcRenderer.invoke('set-auth-status', status),
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
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  // App Settings
  getAppSettings: () => ipcRenderer.invoke('get-app-settings'),
  saveAppSettings: (settings: any) => ipcRenderer.invoke('save-app-settings', settings),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  // Overlay
  openOverlay: () => ipcRenderer.invoke('open-overlay'),
  // Clipboard
  copyToClipboard: (text: string) => ipcRenderer.invoke('copy-to-clipboard', text),
  // URL
  openUrl: (url: string) => ipcRenderer.invoke('open-url', url),
  // IPC Renderer для подписки на события и отправки сообщений
  ipcRenderer: {
    on: (channel: string, callback: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    },
    send: (channel: string, ...args: any[]) => {
      ipcRenderer.send(channel, ...args);
    },
    removeAllListeners: (channel: string) => {
      ipcRenderer.removeAllListeners(channel);
    },
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
