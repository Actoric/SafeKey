import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

let deleteBackupCodeDialogWindow: BrowserWindow | null = null;
let mainWindowRef: BrowserWindow | null = null;

export function setMainWindowRef(window: BrowserWindow | null) {
  mainWindowRef = window;
}

export function showDeleteBackupCodeDialog(codeText: string, isEntry: boolean = false): Promise<boolean> {
  return new Promise((resolve) => {
    const mainWindow = mainWindowRef;
    
    if (deleteBackupCodeDialogWindow) {
      deleteBackupCodeDialogWindow.focus();
      return;
    }

    deleteBackupCodeDialogWindow = new BrowserWindow({
      width: 450,
      height: isEntry ? 250 : 220,
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      modal: true,
      backgroundColor: '#f5f5f5',
      parent: mainWindow || undefined,
      skipTaskbar: true,
      webPreferences: {
        preload: path.join(__dirname, '../preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

    deleteBackupCodeDialogWindow.loadFile(path.join(__dirname, '../../renderer/index.html'), {
      hash: `delete-backup-code-dialog?code=${encodeURIComponent(codeText)}&isEntry=${isEntry}`,
    });

    // Блокируем взаимодействие с главным окном
    if (mainWindow) {
      mainWindow.setEnabled(false);
    }

    // Обработка выбора пользователя через IPC
    const handleIpcMessage = (event: Electron.IpcMainEvent, choice: string) => {
      if (deleteBackupCodeDialogWindow) {
        deleteBackupCodeDialogWindow.close();
      }
      resolve(choice === 'confirm');
    };

    // Подписываемся на IPC сообщения
    ipcMain.once('delete-backup-code-dialog-choice', handleIpcMessage);

    deleteBackupCodeDialogWindow.on('closed', () => {
      ipcMain.removeListener('delete-backup-code-dialog-choice', handleIpcMessage);
      // Разблокируем главное окно
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setEnabled(true);
      }
      deleteBackupCodeDialogWindow = null;
    });
  });
}
