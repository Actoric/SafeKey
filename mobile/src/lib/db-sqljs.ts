/**
 * SQLite в браузере через sql.js. Та же схема, что и в десктопе.
 */
import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id INTEGER,
  level INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE,
  CHECK (level >= 0 AND level <= 2)
);
CREATE TABLE IF NOT EXISTS password_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category_id INTEGER,
  encrypted_data TEXT NOT NULL,
  tags TEXT DEFAULT '',
  is_favorite INTEGER DEFAULT 0,
  bound_app TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_category_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_password_category ON password_entries(category_id);
CREATE INDEX IF NOT EXISTS idx_password_favorite ON password_entries(is_favorite);
CREATE INDEX IF NOT EXISTS idx_password_title ON password_entries(title);
CREATE TRIGGER IF NOT EXISTS update_password_timestamp AFTER UPDATE ON password_entries
BEGIN UPDATE password_entries SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TABLE IF NOT EXISTS backup_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  encrypted_data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_backup_codes_title ON backup_codes(title);
CREATE TRIGGER IF NOT EXISTS update_backup_code_timestamp AFTER UPDATE ON backup_codes
BEGIN UPDATE backup_codes SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TABLE IF NOT EXISTS security_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  encrypted_data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_security_questions_title ON security_questions(title);
CREATE TRIGGER IF NOT EXISTS update_security_question_timestamp AFTER UPDATE ON security_questions
BEGIN UPDATE security_questions SET updated_at = datetime('now') WHERE id = NEW.id; END;
`;

let db: Database | null = null;
let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;

export async function initSqlJsLib(): Promise<void> {
  if (SQL) return;
  SQL = await initSqlJs({ locateFile: (file: string) => `https://sql.js.org/dist/${file}` });
}

export function initDbFromBuffer(buffer: Uint8Array): void {
  if (!SQL) throw new Error('sql.js not initialized');
  if (db) {
    db.close();
    db = null;
  }
  db = new SQL.Database(buffer);
  ensureBoundAppColumn();
}

export function initDbEmpty(): void {
  if (!SQL) throw new Error('sql.js not initialized');
  if (db) {
    db.close();
    db = null;
  }
  db = new SQL.Database();
  db.run(SCHEMA);
}

function ensureBoundAppColumn(): void {
  if (!db) return;
  const info = db.exec("PRAGMA table_info(password_entries)");
  const names = (info[0]?.values || []).map((r: unknown[]) => r[0]) as string[];
  if (!names.includes('bound_app')) {
    db.run('ALTER TABLE password_entries ADD COLUMN bound_app TEXT DEFAULT NULL');
  }
}

function getDb(): Database {
  if (!db) throw new Error('Database not initialized');
  return db;
}

function rowToObj(columns: string[], row: unknown[]): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  columns.forEach((c: string, i: number) => { o[c] = row[i]; });
  return o;
}

/** Выполнить SELECT с параметрами и вернуть массив объектов (prepare/bind/step). */
function execParam<T>(sql: string, params: unknown[]): T[] {
  const d = getDb();
  const stmt = d.prepare(sql);
  try {
    if (params.length) stmt.bind(params);
    const results: Record<string, unknown>[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push(row as Record<string, unknown>);
    }
    return results as T[];
  } finally {
    stmt.free();
  }
}

/** Одна строка по параметрам, или null. */
function execParamOne<T>(sql: string, params: unknown[]): T | null {
  const rows = execParam<T>(sql, params);
  return rows.length ? rows[0] : null;
}

export interface PasswordEntryRow {
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

export function getAllPasswordEntries(): PasswordEntryRow[] {
  const d = getDb();
  const r = d.exec('SELECT * FROM password_entries ORDER BY updated_at DESC');
  if (!r.length || !r[0].values.length) return [];
  const cols = r[0].columns as string[];
  return r[0].values.map((row: unknown[]) => rowToObj(cols, row) as unknown as PasswordEntryRow);
}

export function getPasswordEntriesByCategory(categoryId: number | null): PasswordEntryRow[] {
  return execParam<PasswordEntryRow>('SELECT * FROM password_entries WHERE category_id = ? ORDER BY updated_at DESC', [categoryId]);
}

export function createPasswordEntry(encryptedData: string, title: string, categoryId?: number | null, boundApp?: string | null): PasswordEntryRow {
  const d = getDb();
  d.run(
    'INSERT INTO password_entries (title, category_id, encrypted_data, bound_app) VALUES (?, ?, ?, ?)',
    [title, categoryId ?? null, encryptedData, boundApp ?? null]
  );
  const id = d.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;
  return getPasswordEntryById(id)!;
}

export function getPasswordEntryById(id: number): PasswordEntryRow | null {
  return execParamOne<PasswordEntryRow>('SELECT * FROM password_entries WHERE id = ?', [id]);
}

export function updatePasswordEntry(id: number, encryptedData: string, title?: string, categoryId?: number | null, boundApp?: string | null): PasswordEntryRow | null {
  const d = getDb();
  if (title !== undefined) {
    d.run(
      'UPDATE password_entries SET encrypted_data = ?, title = ?, category_id = ?, bound_app = ? WHERE id = ?',
      [encryptedData, title, categoryId ?? null, boundApp ?? null, id]
    );
  } else {
    d.run('UPDATE password_entries SET encrypted_data = ?, bound_app = ? WHERE id = ?', [encryptedData, boundApp ?? null, id]);
  }
  return getPasswordEntryById(id);
}

export function deletePasswordEntry(id: number): boolean {
  const d = getDb();
  d.run('DELETE FROM password_entries WHERE id = ?', [id]);
  return (d as unknown as { getRowsModified?: () => number }).getRowsModified?.() ? (d as unknown as { getRowsModified: () => number }).getRowsModified() > 0 : true;
}

export function searchPasswordEntries(query: string): PasswordEntryRow[] {
  const term = `%${query}%`;
  return execParam<PasswordEntryRow>('SELECT * FROM password_entries WHERE title LIKE ? OR tags LIKE ? ORDER BY updated_at DESC', [term, term]);
}

export function toggleFavorite(id: number): PasswordEntryRow | null {
  const e = getPasswordEntryById(id);
  if (!e) return null;
  const d = getDb();
  const newVal = e.is_favorite === 0 ? 1 : 0;
  d.run('UPDATE password_entries SET is_favorite = ? WHERE id = ?', [newVal, id]);
  return getPasswordEntryById(id);
}

export function getFavoritePasswordEntries(): PasswordEntryRow[] {
  const d = getDb();
  const r = d.exec('SELECT * FROM password_entries WHERE is_favorite = 1 ORDER BY updated_at DESC');
  if (!r.length || !r[0].values.length) return [];
  const cols = r[0].columns as string[];
  return r[0].values.map((row: unknown[]) => rowToObj(cols, row) as unknown as PasswordEntryRow);
}

export interface CategoryRow {
  id: number;
  name: string;
  parent_id: number | null;
  level: number;
  created_at: string;
}

export function getAllCategories(): CategoryRow[] {
  const d = getDb();
  const r = d.exec('SELECT * FROM categories ORDER BY level, name');
  if (!r.length || !r[0].values.length) return [];
  const cols = r[0].columns as string[];
  return r[0].values.map((row: unknown[]) => rowToObj(cols, row) as unknown as CategoryRow);
}

export function getCategoryById(id: number): CategoryRow | null {
  return execParamOne<CategoryRow>('SELECT * FROM categories WHERE id = ?', [id]);
}

export function createCategory(name: string, parentId?: number | null): CategoryRow {
  let level = 0;
  if (parentId) {
    const parent = getCategoryById(parentId);
    if (parent && parent.level < 2) level = parent.level + 1;
  }
  const d = getDb();
  d.run('INSERT INTO categories (name, parent_id, level) VALUES (?, ?, ?)', [name, parentId ?? null, level]);
  const id = d.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;
  return getCategoryById(id)!;
}

export function updateCategory(id: number, name: string): CategoryRow | null {
  const d = getDb();
  d.run('UPDATE categories SET name = ? WHERE id = ?', [name, id]);
  return getCategoryById(id);
}

export function deleteCategory(id: number): boolean {
  const d = getDb();
  d.run('DELETE FROM categories WHERE id = ?', [id]);
  return (d as unknown as { getRowsModified?: () => number }).getRowsModified?.() ? (d as unknown as { getRowsModified: () => number }).getRowsModified() > 0 : true;
}

export function updatePasswordEntryBoundApp(id: number, boundApp: string | null): PasswordEntryRow | null {
  const d = getDb();
  d.run('UPDATE password_entries SET bound_app = ? WHERE id = ?', [boundApp, id]);
  return getPasswordEntryById(id);
}

// Backup codes
export interface BackupCodeRow {
  id: number;
  title: string;
  encrypted_data: string;
  created_at: string;
  updated_at: string;
}

export function getAllBackupCodeEntries(): BackupCodeRow[] {
  const d = getDb();
  const r = d.exec('SELECT * FROM backup_codes ORDER BY updated_at DESC');
  if (!r.length || !r[0].values.length) return [];
  const cols = r[0].columns as string[];
  return r[0].values.map((row: unknown[]) => rowToObj(cols, row) as unknown as BackupCodeRow);
}

export function getBackupCodeEntryById(id: number): BackupCodeRow | null {
  return execParamOne<BackupCodeRow>('SELECT * FROM backup_codes WHERE id = ?', [id]);
}

export function createBackupCodeEntry(encryptedData: string, title: string): BackupCodeRow {
  const d = getDb();
  d.run('INSERT INTO backup_codes (title, encrypted_data) VALUES (?, ?)', [title, encryptedData]);
  const id = d.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;
  return getBackupCodeEntryById(id)!;
}

export function updateBackupCodeEntry(id: number, encryptedData: string, title?: string): BackupCodeRow | null {
  const d = getDb();
  if (title !== undefined) {
    d.run('UPDATE backup_codes SET encrypted_data = ?, title = ? WHERE id = ?', [encryptedData, title, id]);
  } else {
    d.run('UPDATE backup_codes SET encrypted_data = ? WHERE id = ?', [encryptedData, id]);
  }
  return getBackupCodeEntryById(id);
}

export function deleteBackupCodeEntry(id: number): boolean {
  const d = getDb();
  d.run('DELETE FROM backup_codes WHERE id = ?', [id]);
  return (d as unknown as { getRowsModified?: () => number }).getRowsModified?.() ? (d as unknown as { getRowsModified: () => number }).getRowsModified() > 0 : true;
}

// Security questions
export interface SecurityQuestionRow {
  id: number;
  title: string;
  encrypted_data: string;
  created_at: string;
  updated_at: string;
}

export function getAllSecurityQuestionEntries(): SecurityQuestionRow[] {
  const d = getDb();
  const r = d.exec('SELECT * FROM security_questions ORDER BY updated_at DESC');
  if (!r.length || !r[0].values.length) return [];
  const cols = r[0].columns as string[];
  return r[0].values.map((row: unknown[]) => rowToObj(cols, row) as unknown as SecurityQuestionRow);
}

export function getSecurityQuestionEntryById(id: number): SecurityQuestionRow | null {
  return execParamOne<SecurityQuestionRow>('SELECT * FROM security_questions WHERE id = ?', [id]);
}

export function createSecurityQuestionEntry(encryptedData: string, title: string): SecurityQuestionRow {
  const d = getDb();
  d.run('INSERT INTO security_questions (title, encrypted_data) VALUES (?, ?)', [title, encryptedData]);
  const id = d.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;
  return getSecurityQuestionEntryById(id)!;
}

export function updateSecurityQuestionEntry(id: number, encryptedData: string, title?: string): SecurityQuestionRow | null {
  const d = getDb();
  if (title !== undefined) {
    d.run('UPDATE security_questions SET encrypted_data = ?, title = ? WHERE id = ?', [encryptedData, title, id]);
  } else {
    d.run('UPDATE security_questions SET encrypted_data = ? WHERE id = ?', [encryptedData, id]);
  }
  return getSecurityQuestionEntryById(id);
}

export function deleteSecurityQuestionEntry(id: number): boolean {
  const d = getDb();
  d.run('DELETE FROM security_questions WHERE id = ?', [id]);
  return (d as unknown as { getRowsModified?: () => number }).getRowsModified?.() ? (d as unknown as { getRowsModified: () => number }).getRowsModified() > 0 : true;
}

/** Экспорт БД в бинарный буфер (для синхронизации в облако). */
export function exportDbToBuffer(): Uint8Array {
  const d = getDb();
  return d.export();
}

export function isDbOpen(): boolean {
  return db != null;
}
