import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

let deleteCategoryDialogWindow: BrowserWindow | null = null;
let mainWindowRef: BrowserWindow | null = null;

export function setMainWindowRef(window: BrowserWindow | null) {
  mainWindowRef = window;
}

export function showDeleteCategoryDialog(categoryName: string, hasChildren: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    // Используем сохраненную ссылку на главное окно
    const mainWindow = mainWindowRef;
    
    if (deleteCategoryDialogWindow) {
      deleteCategoryDialogWindow.focus();
      return;
    }

    deleteCategoryDialogWindow = new BrowserWindow({
      width: 450,
      height: hasChildren ? 250 : 220,
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

    deleteCategoryDialogWindow.loadFile(path.join(__dirname, '../../renderer/index.html'), {
      hash: `delete-category-dialog?name=${encodeURIComponent(categoryName)}&hasChildren=${hasChildren}`,
    });

    // Обработка выбора пользователя через IPC
    const handleIpcMessage = (event: Electron.IpcMainEvent, choice: string) => {
      if (deleteCategoryDialogWindow) {
        deleteCategoryDialogWindow.close();
      }
      resolve(choice === 'confirm');
    };

    // Подписываемся на IPC сообщения
    ipcMain.once('delete-category-dialog-choice', handleIpcMessage);

    deleteCategoryDialogWindow.on('closed', () => {
      ipcMain.removeListener('delete-category-dialog-choice', handleIpcMessage);
      // Разблокируем главное окно
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setEnabled(true);
      }
      deleteCategoryDialogWindow = null;
    });
  });
}
