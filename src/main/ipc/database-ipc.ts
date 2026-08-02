import { ipcMain } from 'electron';
import { runtime } from '../runtime-context';
import { DatabaseService } from '../database/database';

export function registerDatabaseIpc(): void {
  ipcMain.handle('init-database', async (_, dbPath: string) => {
    if (!runtime.dbService) {
      runtime.dbService = new DatabaseService(dbPath);
      await runtime.dbService.initialize();
    }
    return { success: true };
  });
}
