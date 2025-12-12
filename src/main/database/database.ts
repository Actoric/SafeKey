import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';
import { PasswordEntry, Category } from '../types';

import { PATHS } from '../config/paths.config';

export class DatabaseService {
  private db: Database.Database;

  constructor(dbPath?: string) {
    this.db = new Database(dbPath || PATHS.database());
  }

  async initialize(): Promise<void> {
    this.db.exec(`
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
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_category_parent ON categories(parent_id);
      CREATE INDEX IF NOT EXISTS idx_password_category ON password_entries(category_id);
      CREATE INDEX IF NOT EXISTS idx_password_favorite ON password_entries(is_favorite);
      CREATE INDEX IF NOT EXISTS idx_password_title ON password_entries(title);

      CREATE TRIGGER IF NOT EXISTS update_password_timestamp 
      AFTER UPDATE ON password_entries
      BEGIN
        UPDATE password_entries 
        SET updated_at = datetime('now') 
        WHERE id = NEW.id;
      END;

      CREATE TABLE IF NOT EXISTS backup_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        encrypted_data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_backup_codes_title ON backup_codes(title);

      CREATE TRIGGER IF NOT EXISTS update_backup_code_timestamp 
      AFTER UPDATE ON backup_codes
      BEGIN
        UPDATE backup_codes 
        SET updated_at = datetime('now') 
        WHERE id = NEW.id;
      END;

      CREATE TABLE IF NOT EXISTS security_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        encrypted_data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_security_questions_title ON security_questions(title);

      CREATE TRIGGER IF NOT EXISTS update_security_question_timestamp 
      AFTER UPDATE ON security_questions
      BEGIN
        UPDATE security_questions 
        SET updated_at = datetime('now') 
        WHERE id = NEW.id;
      END;
    `);
  }

  createPasswordEntry(encryptedData: string, title: string, categoryId?: number | null): PasswordEntry | null {
    const stmt = this.db.prepare(`
      INSERT INTO password_entries (title, category_id, encrypted_data)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(title, categoryId || null, encryptedData);
    return this.getPasswordEntryById(result.lastInsertRowid as number)!;
  }

  getPasswordEntryById(id: number): PasswordEntry | null {
    const stmt = this.db.prepare('SELECT * FROM password_entries WHERE id = ?');
    return stmt.get(id) as PasswordEntry | null;
  }

  getAllPasswordEntries(): PasswordEntry[] {
    const stmt = this.db.prepare('SELECT * FROM password_entries ORDER BY updated_at DESC');
    return stmt.all() as PasswordEntry[];
  }

  updatePasswordEntry(id: number, encryptedData: string, title?: string, categoryId?: number | null): PasswordEntry | null {
    if (title) {
      const stmt = this.db.prepare(`
        UPDATE password_entries 
        SET encrypted_data = ?, title = ?, category_id = ?
        WHERE id = ?
      `);
      stmt.run(encryptedData, title, categoryId || null, id);
    } else {
      const stmt = this.db.prepare(`
        UPDATE password_entries 
        SET encrypted_data = ?
        WHERE id = ?
      `);
      stmt.run(encryptedData, id);
    }
    return this.getPasswordEntryById(id);
  }

  deletePasswordEntry(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM password_entries WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  searchPasswordEntries(query: string): PasswordEntry[] {
    const searchTerm = `%${query}%`;
    const stmt = this.db.prepare(`
      SELECT * FROM password_entries 
      WHERE title LIKE ? OR tags LIKE ?
      ORDER BY updated_at DESC
    `);
    return stmt.all(searchTerm, searchTerm) as PasswordEntry[];
  }

  toggleFavorite(id: number): PasswordEntry | null {
    const entry = this.getPasswordEntryById(id);
    if (!entry) return null;
    const stmt = this.db.prepare(`
      UPDATE password_entries 
      SET is_favorite = ? 
      WHERE id = ?
    `);
    const newValue = entry.is_favorite === 0 ? 1 : 0;
    stmt.run(newValue, id);
    return this.getPasswordEntryById(id);
  }

  getFavoritePasswordEntries(): PasswordEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM password_entries 
      WHERE is_favorite = 1 
      ORDER BY updated_at DESC
    `);
    return stmt.all() as PasswordEntry[];
  }

  getPasswordEntriesByCategory(categoryId: number | null): PasswordEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM password_entries 
      WHERE category_id = ? 
      ORDER BY updated_at DESC
    `);
    return stmt.all(categoryId) as PasswordEntry[];
  }

  createCategory(name: string, parentId?: number | null): Category {
    let level = 0;
    if (parentId) {
      const parent = this.getCategoryById(parentId);
      if (parent && parent.level < 2) {
        level = parent.level + 1;
      } else {
        throw new Error('Максимальный уровень вложенности достигнут (3 уровня)');
      }
    }

    const stmt = this.db.prepare(`
      INSERT INTO categories (name, parent_id, level)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(name, parentId || null, level);
    return this.getCategoryById(result.lastInsertRowid as number)!;
  }

  getCategoryById(id: number): Category | null {
    const stmt = this.db.prepare('SELECT * FROM categories WHERE id = ?');
    return stmt.get(id) as Category | null;
  }

  getAllCategories(): Category[] {
    const stmt = this.db.prepare('SELECT * FROM categories ORDER BY level, name');
    return stmt.all() as Category[];
  }

  getCategoriesByParent(parentId: number | null): Category[] {
    const stmt = this.db.prepare('SELECT * FROM categories WHERE parent_id = ? ORDER BY name');
    return stmt.all(parentId) as Category[];
  }

  updateCategory(id: number, name: string): Category | null {
    const stmt = this.db.prepare('UPDATE categories SET name = ? WHERE id = ?');
    stmt.run(name, id);
    return this.getCategoryById(id);
  }

  deleteCategory(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM categories WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Backup Codes methods
  createBackupCodeEntry(encryptedData: string, title: string): any {
    const stmt = this.db.prepare(`
      INSERT INTO backup_codes (title, encrypted_data)
      VALUES (?, ?)
    `);
    const result = stmt.run(title, encryptedData);
    return this.getBackupCodeEntryById(result.lastInsertRowid as number);
  }

  getBackupCodeEntryById(id: number): any {
    const stmt = this.db.prepare('SELECT * FROM backup_codes WHERE id = ?');
    return stmt.get(id);
  }

  getAllBackupCodeEntries(): any[] {
    const stmt = this.db.prepare('SELECT * FROM backup_codes ORDER BY updated_at DESC');
    return stmt.all();
  }

  updateBackupCodeEntry(id: number, encryptedData: string, title?: string): any {
    if (title) {
      const stmt = this.db.prepare(`
        UPDATE backup_codes 
        SET encrypted_data = ?, title = ?
        WHERE id = ?
      `);
      stmt.run(encryptedData, title, id);
    } else {
      const stmt = this.db.prepare(`
        UPDATE backup_codes 
        SET encrypted_data = ?
        WHERE id = ?
      `);
      stmt.run(encryptedData, id);
    }
    return this.getBackupCodeEntryById(id);
  }

  deleteBackupCodeEntry(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM backup_codes WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Security Questions methods
  createSecurityQuestion(encryptedData: string, title: string): any {
    const stmt = this.db.prepare(`
      INSERT INTO security_questions (title, encrypted_data)
      VALUES (?, ?)
    `);
    const result = stmt.run(title, encryptedData);
    return this.getSecurityQuestionById(result.lastInsertRowid as number);
  }

  getSecurityQuestionById(id: number): any {
    const stmt = this.db.prepare('SELECT * FROM security_questions WHERE id = ?');
    return stmt.get(id);
  }

  getAllSecurityQuestions(): any[] {
    const stmt = this.db.prepare('SELECT * FROM security_questions ORDER BY updated_at DESC');
    return stmt.all();
  }

  updateSecurityQuestion(id: number, encryptedData: string, title?: string): any {
    if (title) {
      const stmt = this.db.prepare(`
        UPDATE security_questions 
        SET encrypted_data = ?, title = ?
        WHERE id = ?
      `);
      stmt.run(encryptedData, title, id);
    } else {
      const stmt = this.db.prepare(`
        UPDATE security_questions 
        SET encrypted_data = ?
        WHERE id = ?
      `);
      stmt.run(encryptedData, id);
    }
    return this.getSecurityQuestionById(id);
  }

  deleteSecurityQuestion(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM security_questions WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  close(): void {
    this.db.close();
  }
}
