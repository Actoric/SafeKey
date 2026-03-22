# Руководство по реализации автообновления в Electron приложении

Этот документ описывает, как реализована система автообновления через GitHub Releases в проекте SafeKey. Используйте это руководство для реализации аналогичной функциональности в вашем Electron приложении.

---

## 📦 Зависимости

Установите необходимую библиотеку:

```bash
npm install electron-updater@^6.6.2
```

---

## 🏗️ Архитектура системы

Система автообновления состоит из трех основных компонентов:

1. **Модуль обновления** (`src/main/updater/github-updater.ts`) - основная логика обновления
2. **Main процесс** (`src/main/main.ts`) - инициализация и IPC обработчики
3. **Renderer процесс** (`src/renderer/src/App.tsx`) - UI для отображения статуса обновления

---

## 1️⃣ Создание модуля обновления

Создайте файл `src/main/updater/github-updater.ts`:

### Основные функции:

#### `initializeUpdater(window, overlay?, tray?)`
Инициализирует систему обновления при запуске приложения.

**Ключевые моменты:**
- Проверяет `app.isPackaged` - обновления работают только в собранном приложении
- Настраивает `autoUpdater.setFeedURL()` с параметрами GitHub репозитория
- Устанавливает `autoDownload = false` для ручного контроля загрузки
- Настраивает автоматическую проверку: через 5 секунд после запуска и каждые 4 часа
- Подписывается на все события `autoUpdater`

**События autoUpdater:**
- `checking-for-update` - началась проверка
- `update-available` - найдено обновление
- `update-not-available` - обновлений нет
- `error` - произошла ошибка
- `download-progress` - прогресс загрузки
- `update-downloaded` - загрузка завершена

#### `checkForUpdates()`
Ручная проверка обновлений (вызывается из UI).

#### `downloadUpdate()`
Начинает загрузку обновления после того, как пользователь нажал "Обновить".

#### `installUpdate()`
Устанавливает загруженное обновление:
- Закрывает все окна (mainWindow, overlayWindow)
- Уничтожает tray
- Вызывает `autoUpdater.quitAndInstall(false, true)`

#### `updateWindowReferences(window?, overlay?, tray?)`
Обновляет ссылки на окна и tray для корректного закрытия при установке обновления.

---

## 2️⃣ Настройка package.json

В секции `build` добавьте:

```json
{
  "build": {
    "publish": [
      {
        "provider": "github",
        "owner": "ВАШ_GITHUB_USERNAME",
        "repo": "ВАШ_РЕПОЗИТОРИЙ"
      }
    ]
  }
}
```

**Важно:** `owner` и `repo` должны точно совпадать с URL вашего репозитория: `github.com/owner/repo`

---

## 3️⃣ Интеграция в main.ts

### Импорт модуля:

```typescript
import { initializeUpdater, checkForUpdates, downloadUpdate, installUpdate, updateWindowReferences } from './updater/github-updater';
```

### Инициализация при создании главного окна:

```typescript
// После создания mainWindow, overlayWindow и tray
initializeUpdater(mainWindow, overlayWindow, tray);
```

### Обновление ссылок при изменении окон:

```typescript
// При создании/уничтожении overlayWindow
updateWindowReferences(mainWindow, overlayWindow, tray);

// При создании/уничтожении tray
updateWindowReferences(mainWindow, overlayWindow, tray);
```

### IPC обработчики:

```typescript
// Ручная проверка обновлений
ipcMain.handle('check-for-updates', async () => {
  try {
    checkForUpdates();
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// Начать загрузку обновления
ipcMain.handle('download-update', async () => {
  downloadUpdate();
});

// Установить обновление
ipcMain.handle('install-update', async () => {
  installUpdate();
});
```

---

## 4️⃣ Настройка preload.ts

Добавьте методы в `electronAPI`:

```typescript
const electronAPI = {
  // ... другие методы
  
  // Auto Updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  
  // IPC Renderer для подписки на события
  ipcRenderer: {
    on: (channel: string, callback: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (_event, ...args) => {
        callback(...args);
      });
    },
    send: (channel: string, ...args: any[]) => {
      ipcRenderer.send(channel, ...args);
    },
    removeAllListeners: (channel: string) => {
      ipcRenderer.removeAllListeners(channel);
    },
  },
};
```

---

## 5️⃣ UI в Renderer процессе

### Подписка на события обновления:

В `App.tsx` или главном компоненте:

```typescript
useEffect(() => {
  if (window.electronAPI && (window.electronAPI as any).ipcRenderer) {
    const ipcRenderer = (window.electronAPI as any).ipcRenderer;
    
    // Обработчики событий
    const handleUpdateChecking = () => {
      setUpdateStatus('checking');
    };
    
    const handleUpdateAvailable = (info: any) => {
      setUpdateStatus('available');
      setUpdateVersion(info.version);
    };
    
    const handleUpdateProgress = (progress: any) => {
      setUpdateStatus('downloading');
      setUpdateProgress(progress.percent);
    };
    
    const handleUpdateDownloaded = (info: any) => {
      setUpdateStatus('downloaded');
      // Автоматическая установка через 3 секунды
      setTimeout(() => {
        setUpdateStatus('ready');
        window.electronAPI.installUpdate();
      }, 3000);
    };
    
    const handleUpdateError = (error: any) => {
      setUpdateStatus('error');
      setUpdateError(error.message);
    };
    
    const handleUpdateNotAvailable = () => {
      setUpdateStatus('completed');
      setUpdateResultMessage('Программа обновлена до последней версии');
    };
    
    // Подписка
    ipcRenderer.on('update-checking', handleUpdateChecking);
    ipcRenderer.on('update-available', handleUpdateAvailable);
    ipcRenderer.on('update-download-progress', handleUpdateProgress);
    ipcRenderer.on('update-downloaded', handleUpdateDownloaded);
    ipcRenderer.on('update-error', handleUpdateError);
    ipcRenderer.on('update-not-available', handleUpdateNotAvailable);
    
    // Очистка при размонтировании
    return () => {
      ipcRenderer.removeAllListeners('update-checking');
      ipcRenderer.removeAllListeners('update-available');
      ipcRenderer.removeAllListeners('update-download-progress');
      ipcRenderer.removeAllListeners('update-downloaded');
      ipcRenderer.removeAllListeners('update-error');
      ipcRenderer.removeAllListeners('update-not-available');
    };
  }
}, []);
```

### Кнопка "Обновить":

```typescript
<button onClick={async () => {
  setUpdateStatus('downloading');
  await window.electronAPI.downloadUpdate();
}}>
  Обновить
</button>
```

---

## 6️⃣ Создание релиза на GitHub

### Шаг 1: Обновите версию в package.json

```json
{
  "version": "1.1.7"
}
```

### Шаг 2: Соберите установщик

```bash
npm run build:win
```

Это создаст в папке `release/`:
- `YourApp-Setup-1.1.7-x64.exe` - установщик
- `YourApp-Setup-1.1.7-x64.exe.blockmap` - блок-карта
- `latest.yml` - метаданные для автообновления

### Шаг 3: Создайте GitHub Release

1. Перейдите на GitHub: `https://github.com/owner/repo/releases`
2. Нажмите "Create a new release"
3. Заполните:
   - **Tag version:** `v1.1.7` (важно: формат `v{version}`)
   - **Release title:** `v1.1.7`
   - **Description:** Описание изменений

### Шаг 4: Загрузите файлы

**Обязательно загрузите все три файла:**
1. `YourApp-Setup-1.1.7-x64.exe`
2. `YourApp-Setup-1.1.7-x64.exe.blockmap`
3. `latest.yml`

**Важно:**
- Все файлы должны быть в одном релизе
- `latest.yml` должен быть в корне релиза (не в архиве)
- Тег должен иметь формат `v{version}` и совпадать с версией в `package.json`

### Шаг 5: Опубликуйте релиз

Нажмите "Publish release"

---

## 7️⃣ Важные замечания

### Проверка режима разработки

Обновления **НЕ работают** в режиме разработки (`npm run dev`). Они работают только в собранном приложении (`app.isPackaged === true`).

### Формат версий

Используйте семантическое версионирование (SemVer): `MAJOR.MINOR.PATCH`

### Теги GitHub

Всегда используйте префикс `v` в тегах: `v1.1.7`, а не `1.1.7`

### latest.yml

Этот файл критически важен - без него обновления не работают. Он создается автоматически `electron-builder` при сборке.

### Цифровая подпись

Если приложение не подписано, отключите проверку подписи:

```typescript
(autoUpdater as any).verifySignatureOnUpdate = false;
```

---

## 8️⃣ Полный пример кода модуля обновления

```typescript
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import { BrowserWindow, app, Tray } from 'electron';

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

export function updateWindowReferences(
  window?: BrowserWindow | null, 
  overlay?: BrowserWindow | null, 
  trayInstance?: Tray | null
) {
  if (window !== undefined) mainWindow = window;
  if (overlay !== undefined) overlayWindow = overlay;
  if (trayInstance !== undefined) tray = trayInstance;
}

export function initializeUpdater(
  window: BrowserWindow, 
  overlay?: BrowserWindow | null, 
  trayInstance?: Tray | null
) {
  mainWindow = window;
  overlayWindow = overlay || null;
  tray = trayInstance || null;

  // Обновления только в production
  if (!app.isPackaged) {
    console.log('[Updater] Обновления отключены в dev режиме');
    return;
  }

  // Настройка GitHub
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'ВАШ_USERNAME',
    repo: 'ВАШ_РЕПОЗИТОРИЙ',
  });

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  (autoUpdater as any).verifySignatureOnUpdate = false;

  // Автоматическая проверка
  setTimeout(() => {
    checkForUpdates();
  }, 5000);

  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 4 * 60 * 60 * 1000);

  // События
  autoUpdater.on('checking-for-update', () => {
    if (mainWindow) {
      mainWindow.webContents.send('update-checking');
    }
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    if (mainWindow) {
      mainWindow.webContents.send('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseName: info.releaseName,
      });
    }
  });

  autoUpdater.on('update-not-available', () => {
    if (mainWindow) {
      mainWindow.webContents.send('update-not-available');
    }
  });

  autoUpdater.on('error', (err: Error) => {
    if (mainWindow) {
      mainWindow.webContents.send('update-error', { 
        message: err.message 
      });
    }
  });

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    if (mainWindow) {
      mainWindow.webContents.send('update-download-progress', {
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
      });
    }
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', {
        version: info.version,
      });
    }
    
    // Автоустановка через 3 секунды
    setTimeout(() => {
      installUpdate();
    }, 3000);
  });
}

export function checkForUpdates() {
  if (!app.isPackaged) return;
  autoUpdater.checkForUpdates();
}

export function downloadUpdate() {
  if (!app.isPackaged) return;
  autoUpdater.downloadUpdate();
}

export function installUpdate() {
  if (!app.isPackaged) return;
  
  if (overlayWindow) overlayWindow.destroy();
  if (mainWindow) mainWindow.destroy();
  if (tray) tray.destroy();
  
  setTimeout(() => {
    autoUpdater.quitAndInstall(false, true);
  }, 500);
}
```

---

## 9️⃣ Типизация TypeScript

Добавьте в `src/shared/types/index.ts`:

```typescript
export interface ElectronAPI {
  // ... другие методы
  
  // Auto Updater
  checkForUpdates: () => Promise<{ success: boolean; message?: string }>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  
  // IPC Renderer
  ipcRenderer?: {
    on: (channel: string, callback: (...args: any[]) => void) => void;
    send: (channel: string, ...args: any[]) => void;
    removeAllListeners: (channel: string) => void;
  };
}
```

---

## ✅ Чек-лист реализации

- [ ] Установлен `electron-updater`
- [ ] Создан модуль `github-updater.ts`
- [ ] Настроен `publish` в `package.json`
- [ ] Интегрирован в `main.ts` (инициализация + IPC обработчики)
- [ ] Добавлены методы в `preload.ts`
- [ ] Реализована подписка на события в renderer
- [ ] Создан UI компонент для отображения статуса обновления
- [ ] Протестировано создание релиза на GitHub
- [ ] Проверена работа обновления в собранном приложении

---

## 🔍 Отладка

### Логи в консоли:

Модуль обновления выводит подробные логи:
- `[Updater] Проверка обновлений...`
- `[Updater] ✅ Доступно обновление!`
- `[Updater] Прогресс: 45.23%`

### Проверка API GitHub:

Откройте в браузере:
```
https://api.github.com/repos/ВАШ_USERNAME/ВАШ_РЕПОЗИТОРИЙ/releases/latest
```

Должен вернуться JSON с информацией о последнем релизе.

### Проверка latest.yml:

Убедитесь, что файл доступен по прямой ссылке:
```
https://github.com/ВАШ_USERNAME/ВАШ_РЕПОЗИТОРИЙ/releases/download/v1.1.7/latest.yml
```

---

**Готово!** Теперь ваше приложение будет автоматически проверять и предлагать обновления через GitHub Releases.
