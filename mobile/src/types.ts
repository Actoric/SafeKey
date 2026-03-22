/** Минимальные типы, совместимые с десктопным SafeKey. */
export interface PasswordEntryData {
  service: string;
  login: string;
  password: string;
  url?: string;
  notes?: string;
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
  language?: string;
  theme?: 'light' | 'dark';
}

export interface CreatePasswordEntryRequest {
  title: string;
  category_id?: number | null;
  data: PasswordEntryData;
  bound_app?: string | null;
}

export interface UpdatePasswordEntryRequest {
  title?: string;
  category_id?: number | null;
  data?: PasswordEntryData;
  bound_app?: string | null;
}

export interface DatabasePasswordEntry {
  id: number;
  title: string;
  category_id: number | null;
  encrypted_data: string;
  tags: string;
  is_favorite: number;
  bound_app: string | null;
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

export interface BackupCode {
  code: string;
  used: boolean;
}

export interface BackupCodeEntryData {
  title: string;
  codes: BackupCode[];
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
