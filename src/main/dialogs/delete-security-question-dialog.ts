import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

let deleteSecurityQuestionDialogWindow: BrowserWindow | null = null;
let mainWindowRef: BrowserWindow | null = null;

export function setMainWindowRef(window: BrowserWindow | null) {
  mainWindowRef = window;
}

export function showDeleteSecurityQuestionDialog(entryTitle: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Используем сохраненную ссылку на главное окно
    const mainWindow = mainWindowRef;
    
    if (deleteSecurityQuestionDialogWindow) {
      deleteSecurityQuestionDialogWindow.focus();
      return;
    }

    deleteSecurityQuestionDialogWindow = new BrowserWindow({
      width: 450,
      height: 220,
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      modal: true,
      backgroundColor: '#f5f5f5',
      parent: mainWindow || undefined, // Делаем модальным относительно главного окна
      skipTaskbar: true, // Не показывать в панели задач
      webPreferences: {
        preload: path.join(__dirname, '../preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });
    
    // Блокируем взаимодействие с главным окном
    if (mainWindow) {
      mainWindow.setEnabled(false);
    }

    deleteSecurityQuestionDialogWindow.loadFile(path.join(__dirname, '../../renderer/index.html'), {
      hash: `delete-security-question-dialog?title=${encodeURIComponent(entryTitle)}`,
    });

    // Обработка выбора пользователя через IPC
    const handleIpcMessage = (event: Electron.IpcMainEvent, choice: string) => {
      if (deleteSecurityQuestionDialogWindow) {
        deleteSecurityQuestionDialogWindow.close();
      }
      resolve(choice === 'confirm');
    };

    // Подписываемся на IPC сообщения
    ipcMain.once('delete-security-question-dialog-choice', handleIpcMessage);

    deleteSecurityQuestionDialogWindow.on('closed', () => {
      ipcMain.removeListener('delete-security-question-dialog-choice', handleIpcMessage);
      // Разблокируем главное окно
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setEnabled(true);
      }
      deleteSecurityQuestionDialogWindow = null;
    });
  });
}
