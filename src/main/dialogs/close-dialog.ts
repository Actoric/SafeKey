import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

let closeDialogWindow: BrowserWindow | null = null;
let mainWindowRef: BrowserWindow | null = null;

export function setMainWindowRef(window: BrowserWindow | null) {
  mainWindowRef = window;
}

export function showCloseDialog(): Promise<'minimize' | 'quit'> {
  return new Promise((resolve) => {
    // Используем сохраненную ссылку на главное окно
    const mainWindow = mainWindowRef;
    
    if (closeDialogWindow) {
      closeDialogWindow.focus();
      return;
    }

    closeDialogWindow = new BrowserWindow({
      width: 450,
      height: 240,
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

    closeDialogWindow.loadFile(path.join(__dirname, '../../renderer/index.html'), {
      hash: 'close-dialog',
    });

    // Обработка выбора пользователя через IPC
    const handleIpcMessage = (event: Electron.IpcMainEvent, choice: string) => {
      if (closeDialogWindow) {
        closeDialogWindow.close();
      }
      resolve(choice === 'minimize' ? 'minimize' : 'quit');
    };

    // Подписываемся на IPC сообщения
    ipcMain.once('close-dialog-choice', handleIpcMessage);

    closeDialogWindow.on('closed', () => {
      ipcMain.removeListener('close-dialog-choice', handleIpcMessage);
      // Разблокируем главное окно
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setEnabled(true);
      }
      closeDialogWindow = null;
    });
  });
}
