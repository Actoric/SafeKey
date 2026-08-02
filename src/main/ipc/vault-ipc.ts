import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { ipcMain, dialog } from 'electron';
import { runtime } from '../runtime-context';
import { ensureEncryptionInitialized } from '../encryption-init';
import { getActiveWindowApp } from '../windows';
import { showDeleteCategoryDialog } from '../dialogs/delete-category-dialog';
import { showDeleteSecurityQuestionDialog } from '../dialogs/delete-security-question-dialog';
import { showDeleteBackupCodeDialog } from '../dialogs/delete-backup-code-dialog';
import type { PasswordEntry } from '../types';

const execAsync = promisify(exec);

function mapPasswordEntryWithDecrypt(entry: PasswordEntry) {
  const encService = runtime.encryptionService!;
  try {
    const decrypted = encService.decrypt(entry.encrypted_data);
    if (!decrypted || decrypted.trim() === '') {
      console.warn('[Main] Пустые данные для записи:', entry.id);
      return {
        ...entry,
        data: { service: '', login: '', password: '', url: '', notes: '' },
      };
    }
    return {
      ...entry,
      data: JSON.parse(decrypted),
    };
  } catch (error) {
    console.error('[Main] Ошибка расшифровки записи:', entry.id, error);
    return {
      ...entry,
      data: { service: '', login: '', password: '', url: '', notes: '' },
    };
  }
}

export function registerVaultIpc(): void {
  ipcMain.handle('create-password-entry', async (_, entry: { data: unknown; title?: string; category_id?: number; bound_app?: string }) => {
    if (!runtime.dbService) {
      throw new Error('Database not initialized');
    }
    await ensureEncryptionInitialized();
    const encrypted = runtime.encryptionService!.encrypt(JSON.stringify(entry.data));
    return runtime.dbService.createPasswordEntry(
      encrypted,
      entry.title || 'Без названия',
      entry.category_id,
      entry.bound_app
    );
  });

  ipcMain.handle('get-password-entries', async () => {
    if (!runtime.dbService) {
      throw new Error('Database not initialized');
    }
    await ensureEncryptionInitialized();
    const entries = await runtime.dbService.getAllPasswordEntries();
    return entries.map((entry) => mapPasswordEntryWithDecrypt(entry));
  });

  ipcMain.handle('update-password-entry', async (_, id: number, entry: { data: unknown; title?: string; category_id?: number; bound_app?: string }) => {
    if (!runtime.dbService) {
      throw new Error('Database not initialized');
    }
    await ensureEncryptionInitialized();
    const encrypted = runtime.encryptionService!.encrypt(JSON.stringify(entry.data));
    return runtime.dbService.updatePasswordEntry(id, encrypted, entry.title, entry.category_id, entry.bound_app);
  });

  ipcMain.handle('delete-password-entry', async (_, id: number) => {
    if (!runtime.dbService) {
      throw new Error('Database not initialized');
    }
    return runtime.dbService.deletePasswordEntry(id);
  });

  ipcMain.handle('search-passwords', async (_, query: string) => {
    if (!runtime.dbService) {
      throw new Error('Database not initialized');
    }
    await ensureEncryptionInitialized();
    const entries = await runtime.dbService.searchPasswordEntries(query);
    return entries.map((entry) => mapPasswordEntryWithDecrypt(entry));
  });

  ipcMain.handle('toggle-favorite', async (_, id: number) => {
    if (!runtime.dbService) {
      throw new Error('Database not initialized');
    }
    await ensureEncryptionInitialized();
    const entry = runtime.dbService.toggleFavorite(id);
    if (!entry) return null;
    return mapPasswordEntryWithDecrypt(entry);
  });

  ipcMain.handle('get-favorite-passwords', async () => {
    if (!runtime.dbService) {
      throw new Error('Database not initialized');
    }
    await ensureEncryptionInitialized();
    const entries = runtime.dbService.getFavoritePasswordEntries();
    return entries.map((entry) => mapPasswordEntryWithDecrypt(entry));
  });

  ipcMain.handle('create-category', async (_, name: string, parentId?: number | null) => {
    if (!runtime.dbService) {
      throw new Error('Database not initialized');
    }
    return runtime.dbService.createCategory(name, parentId);
  });

  ipcMain.handle('get-categories', async () => {
    if (!runtime.dbService) {
      throw new Error('Database not initialized');
    }
    return runtime.dbService.getAllCategories();
  });

  ipcMain.handle('update-category', async (_, id: number, name: string) => {
    if (!runtime.dbService) {
      throw new Error('Database not initialized');
    }
    return runtime.dbService.updateCategory(id, name);
  });

  ipcMain.handle('update-password-entry-bound-app', async (_, id: number, boundApp: string | null) => {
    if (!runtime.dbService) {
      throw new Error('Database not initialized');
    }
    return runtime.dbService.updatePasswordEntryBoundApp(id, boundApp);
  });

  ipcMain.handle('delete-category', async (_, id: number) => {
    if (!runtime.dbService) {
      throw new Error('Database not initialized');
    }
    return runtime.dbService.deleteCategory(id);
  });

  ipcMain.handle('get-active-app', async () => getActiveWindowApp());

  ipcMain.handle('select-exe-file', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Выберите исполняемый файл приложения',
      filters: [
        { name: 'Исполняемые файлы', extensions: ['exe'] },
        { name: 'Все файлы', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const exePath = result.filePaths[0];
    const fileName = path.basename(exePath, '.exe');
    console.log('[Main] Выбран .exe файл:', exePath, 'Имя процесса:', fileName);
    return fileName;
  });

  ipcMain.handle('get-running-apps', async () => {
    if (process.platform !== 'win32') {
      return [];
    }

    try {
      const command = `powershell -Command "Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object -Property ProcessName, MainWindowTitle | Sort-Object ProcessName -Unique | ConvertTo-Json"`;
      const { stdout } = await execAsync(command, { timeout: 5000 });
      const processes = JSON.parse(stdout);
      const apps = Array.isArray(processes) ? processes : [processes];
      const uniqueApps = [...new Set(apps.map((p: { ProcessName?: string }) => p.ProcessName))].filter(Boolean);
      return uniqueApps.sort();
    } catch (error) {
      console.error('[Main] Ошибка получения списка приложений:', error);
      return [];
    }
  });

  ipcMain.handle('show-delete-category-dialog', async (_, categoryName: string, hasChildren: boolean) => {
    return await showDeleteCategoryDialog(categoryName, hasChildren);
  });

  ipcMain.handle('show-delete-security-question-dialog', async (_, entryTitle: string) => {
    return await showDeleteSecurityQuestionDialog(entryTitle);
  });

  ipcMain.handle('show-delete-backup-code-dialog', async (_, codeText: string, isEntry: boolean = false) => {
    return await showDeleteBackupCodeDialog(codeText, isEntry);
  });

  ipcMain.handle('create-backup-code-entry', async (_, entry: { title: string; codes: string[] }) => {
    if (!runtime.dbService) {
      throw new Error('Database not initialized');
    }
    await ensureEncryptionInitialized();
    const codes = entry.codes.map((code: string) => ({ code, used: false }));
    const data = { title: entry.title, codes };
    const encrypted = runtime.encryptionService!.encrypt(JSON.stringify(data));
    return runtime.dbService.createBackupCodeEntry(encrypted, entry.title);
  });

  ipcMain.handle('get-backup-code-entries', async () => {
    if (!runtime.dbService) {
      throw new Error('Database not initialized');
    }
    await ensureEncryptionInitialized();
    return await runtime.dbService.getAllBackupCodeEntries();
  });

  ipcMain.handle('get-backup-code-entry-by-id', async (_, id: number) => {
    if (!runtime.dbService) {
      throw new Error('Database not initialized');
    }
    return runtime.dbService.getBackupCodeEntryById(id);
  });

  ipcMain.handle('update-backup-code-entry', async (_, id: number, entry: { title?: string; codes?: unknown }) => {
    if (!runtime.dbService) {
      throw new Error('Database not initialized');
    }
    await ensureEncryptionInitialized();
    const existing = runtime.dbService.getBackupCodeEntryById(id);
    if (!existing) {
      throw new Error('Entry not found');
    }

    const decrypted = runtime.encryptionService!.decrypt(existing.encrypted_data);
    const existingData = JSON.parse(decrypted) as { title?: string; codes?: unknown };

    if (entry.title !== undefined) {
      existingData.title = entry.title;
    }
    if (entry.codes !== undefined) {
      existingData.codes = entry.codes;
    }

    const encrypted = runtime.encryptionService!.encrypt(JSON.stringify(existingData));
    return runtime.dbService.updateBackupCodeEntry(id, encrypted, entry.title);
  });

  ipcMain.handle('delete-backup-code-entry', async (_, id: number) => {
    if (!runtime.dbService) {
      throw new Error('Database not initialized');
    }
    return runtime.dbService.deleteBackupCodeEntry(id);
  });

  ipcMain.handle('decrypt-backup-code-entry', async (_, entry: { encrypted_data: string }) => {
    if (!runtime.encryptionService) {
      await ensureEncryptionInitialized();
    }
    try {
      const decrypted = runtime.encryptionService!.decrypt(entry.encrypted_data);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('[Main] Ошибка расшифровки резервного кода:', error);
      throw error;
    }
  });

  ipcMain.handle('create-security-question-entry', async (_, entry: { title: string; questions: unknown }) => {
    if (!runtime.dbService) {
      throw new Error('Database not initialized');
    }
    await ensureEncryptionInitialized();
    const data = { title: entry.title, questions: entry.questions };
    const encrypted = runtime.encryptionService!.encrypt(JSON.stringify(data));
    return runtime.dbService.createSecurityQuestion(encrypted, entry.title);
  });

  ipcMain.handle('get-security-question-entries', async () => {
    if (!runtime.dbService) {
      throw new Error('Database not initialized');
    }
    await ensureEncryptionInitialized();
    return await runtime.dbService.getAllSecurityQuestions();
  });

  ipcMain.handle('get-security-question-entry-by-id', async (_, id: number) => {
    if (!runtime.dbService) {
      throw new Error('Database not initialized');
    }
    return runtime.dbService.getSecurityQuestionById(id);
  });

  ipcMain.handle('update-security-question-entry', async (_, id: number, entry: { title?: string; questions?: unknown }) => {
    if (!runtime.dbService) {
      throw new Error('Database not initialized');
    }
    await ensureEncryptionInitialized();
    const existing = runtime.dbService.getSecurityQuestionById(id);
    if (!existing) {
      throw new Error('Entry not found');
    }

    const decrypted = runtime.encryptionService!.decrypt(existing.encrypted_data);
    const existingData = JSON.parse(decrypted) as { title?: string; questions?: unknown };

    if (entry.title !== undefined) {
      existingData.title = entry.title;
    }
    if (entry.questions !== undefined) {
      existingData.questions = entry.questions;
    }

    const encrypted = runtime.encryptionService!.encrypt(JSON.stringify(existingData));
    return runtime.dbService.updateSecurityQuestion(id, encrypted, entry.title);
  });

  ipcMain.handle('delete-security-question-entry', async (_, id: number) => {
    if (!runtime.dbService) {
      throw new Error('Database not initialized');
    }
    return runtime.dbService.deleteSecurityQuestion(id);
  });

  ipcMain.handle('decrypt-security-question-entry', async (_, entry: { encrypted_data: string }) => {
    if (!runtime.encryptionService) {
      await ensureEncryptionInitialized();
    }
    try {
      const decrypted = runtime.encryptionService!.decrypt(entry.encrypted_data);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('[Main] Ошибка расшифровки контрольного вопроса:', error);
      throw error;
    }
  });

  ipcMain.handle('get-passwords-by-category', async (_, categoryId: number | null) => {
    if (!runtime.dbService) {
      throw new Error('Database not initialized');
    }
    await ensureEncryptionInitialized();
    const entries = runtime.dbService.getPasswordEntriesByCategory(categoryId);
    return entries.map((entry) => mapPasswordEntryWithDecrypt(entry));
  });
}
