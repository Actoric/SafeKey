// Общие типы для всего приложения

export interface PasswordEntryData {
  service: string;
  login: string;
  password: string;
  url?: string;
  notes?: string;
}

export interface PasswordEntry {
  id: number;
  title: string;
  category_id: number | null;
  data: PasswordEntryData;
  tags: string;
  is_favorite: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  parent_id: number | null;
  level: number;
  created_at: string;
}

export interface DatabasePasswordEntry {
  id: number;
  title: string;
  category_id: number | null;
  encrypted_data: string;
  tags: string;
  is_favorite: number;
  created_at: string;
  updated_at: string;
}

export interface ElectronAPI {
  initDatabase: (dbPath: string) => Promise<{ success: boolean }>;
  setMasterPassword: (password: string) => Promise<{ success: boolean }>;
  verifyMasterPassword: (password: string) => Promise<boolean>;
  checkMasterPasswordInitialized: () => Promise<boolean>;
  createPasswordEntry: (entry: CreatePasswordEntryRequest) => Promise<DatabasePasswordEntry>;
  getPasswordEntries: () => Promise<DatabasePasswordEntry[]>;
  updatePasswordEntry: (id: number, entry: UpdatePasswordEntryRequest) => Promise<DatabasePasswordEntry>;
  deletePasswordEntry: (id: number) => Promise<boolean>;
  searchPasswords: (query: string) => Promise<DatabasePasswordEntry[]>;
  toggleFavorite: (id: number) => Promise<DatabasePasswordEntry | null>;
  getFavoritePasswords: () => Promise<DatabasePasswordEntry[]>;
  // Categories (Раскладки)
  createCategory: (name: string, parentId?: number | null) => Promise<Category>;
  getCategories: () => Promise<Category[]>;
  updateCategory: (id: number, name: string) => Promise<Category | null>;
  deleteCategory: (id: number) => Promise<boolean>;
  getPasswordsByCategory: (categoryId: number | null) => Promise<DatabasePasswordEntry[]>;
  // Cloud storage settings
  getCloudSettings: () => Promise<CloudSettings>;
  saveCloudSettings: (settings: CloudSettings) => Promise<void>;
  syncToCloud: () => Promise<boolean>;
  authorizeYandexDisk: () => Promise<{ success: boolean; token?: string }>;
  checkCloudSync: () => Promise<{ synced: boolean; message: string; files?: string[] }>;
  // App settings
  getAppSettings: () => Promise<AppSettings>;
  saveAppSettings: (settings: AppSettings) => Promise<void>;
  getAppVersion: () => Promise<string>;
  // Overlay
  openOverlay: () => Promise<void>;
  // Clipboard
  copyToClipboard: (text: string) => Promise<void>;
  // URL
  openUrl: (url: string) => Promise<void>;
  // Window controls
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  // Backup Codes
  createBackupCodeEntry: (entry: CreateBackupCodeEntryRequest) => Promise<DatabaseBackupCodeEntry>;
  getBackupCodeEntries: () => Promise<DatabaseBackupCodeEntry[]>;
  getBackupCodeEntryById: (id: number) => Promise<DatabaseBackupCodeEntry>;
  updateBackupCodeEntry: (id: number, entry: UpdateBackupCodeEntryRequest) => Promise<DatabaseBackupCodeEntry>;
  deleteBackupCodeEntry: (id: number) => Promise<boolean>;
  decryptBackupCodeEntry: (entry: DatabaseBackupCodeEntry) => Promise<BackupCodeEntryData>;
  // Security Questions
  createSecurityQuestionEntry: (entry: CreateSecurityQuestionEntryRequest) => Promise<DatabaseSecurityQuestionEntry>;
  getSecurityQuestionEntries: () => Promise<DatabaseSecurityQuestionEntry[]>;
  getSecurityQuestionEntryById: (id: number) => Promise<DatabaseSecurityQuestionEntry>;
  updateSecurityQuestionEntry: (id: number, entry: UpdateSecurityQuestionEntryRequest) => Promise<DatabaseSecurityQuestionEntry>;
  deleteSecurityQuestionEntry: (id: number) => Promise<boolean>;
  decryptSecurityQuestionEntry: (entry: DatabaseSecurityQuestionEntry) => Promise<SecurityQuestionEntryData>;
  // Auto Updater
  checkForUpdates: () => Promise<{ success: boolean; message?: string }>;
  // Area Selector
  startAreaSelection: () => Promise<{ success: boolean; error?: string }>;
  closeAreaSelector: () => Promise<{ success: boolean }>;
  captureAreaScreenshot: (bounds: { x: number; y: number; width: number; height: number }) => Promise<{ success: boolean; path?: string; dataURL?: string; error?: string }>;
}

export interface CloudSettings {
  yandexDisk?: {
    enabled: boolean;
    token?: string;
    path?: string;
  };
  googleDrive?: {
    enabled: boolean;
    token?: string;
    folderId?: string;
  };
}

export interface AppSettings {
  overlayShortcut?: string;
  openInOverlay?: boolean;
  autoStart?: boolean;
  startMinimized?: boolean;
  minimizeToTray?: boolean;
  language?: string;
}

export interface CreatePasswordEntryRequest {
  title: string;
  category_id?: number | null;
  data: PasswordEntryData;
}

export interface UpdatePasswordEntryRequest {
  title?: string;
  category_id?: number | null;
  data?: PasswordEntryData;
}

export interface BackupCode {
  code: string;
  used: boolean;
}

export interface BackupCodeEntryData {
  title: string;
  codes: BackupCode[];
}

export interface BackupCodeEntry {
  id: number;
  title: string;
  encrypted_data: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseBackupCodeEntry {
  id: number;
  title: string;
  encrypted_data: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBackupCodeEntryRequest {
  title: string;
  codes: string[];
}

export interface UpdateBackupCodeEntryRequest {
  title?: string;
  codes?: BackupCode[];
}

export interface SecurityQuestion {
  question: string;
  answer: string;
}

export interface SecurityQuestionEntryData {
  title: string;
  questions: SecurityQuestion[];
}

export interface SecurityQuestionEntry {
  id: number;
  title: string;
  encrypted_data: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseSecurityQuestionEntry {
  id: number;
  title: string;
  encrypted_data: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSecurityQuestionEntryRequest {
  title: string;
  questions: SecurityQuestion[];
}

export interface UpdateSecurityQuestionEntryRequest {
  title?: string;
  questions?: SecurityQuestion[];
}