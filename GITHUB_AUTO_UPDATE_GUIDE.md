# Руководство по настройке автообновления через GitHub

## 📋 Содержание
1. [Обзор системы автообновления](#обзор-системы-автообновления)
2. [Настройка в package.json](#настройка-в-packagejson)
3. [Структура файлов на GitHub](#структура-файлов-на-github)
4. [Процесс создания релиза](#процесс-создания-релиза)
5. [Как работает автообновление](#как-работает-автообновление)
6. [Частые проблемы и решения](#частые-проблемы-и-решения)
7. [Проверка работоспособности](#проверка-работоспособности)

---

## 🔄 Обзор системы автообновления

SafeKey использует библиотеку `electron-updater` для автоматического обновления через GitHub Releases.

### Основные компоненты:

1. **`src/main/updater/github-updater.ts`** - основной модуль обновления
2. **`package.json`** - конфигурация для electron-builder
3. **GitHub Releases** - хранилище установщиков и метаданных
4. **`latest.yml`** - файл метаданных, создаваемый автоматически

---

## ⚙️ Настройка в package.json

### 1. Конфигурация publish

В `package.json` в секции `build.publish` должно быть:

```json
"publish": [
  {
    "provider": "github",
    "owner": "Actoric",
    "repo": "SafeKey"
  }
]
```

**Важно:**
- `owner` - ваш GitHub username или название организации
- `repo` - название репозитория (должно совпадать с URL: `github.com/owner/repo`)

### 2. Настройка electron-builder

```json
"build": {
  "appId": "com.safekey.app",
  "productName": "SafeKey",
  "directories": {
    "output": "release",
    "buildResources": "build"
  },
  "win": {
    "target": [{
      "target": "nsis",
      "arch": ["x64"]
    }],
    "icon": "build/icon.ico"
  }
}
```

**Ключевые моменты:**
- `output: "release"` - папка, куда electron-builder создает файлы
- `buildResources: "build"` - папка с ресурсами (иконки и т.д.)
- `artifactName` - формат имени файла установщика

---

## 📁 Структура файлов на GitHub

### Обязательные файлы для каждого релиза:

1. **`SafeKey-Setup-{version}-x64.exe`** - установщик приложения
2. **`SafeKey-Setup-{version}-x64.exe.blockmap`** - блок-карта для инкрементальных обновлений
3. **`latest.yml`** - метаданные для автообновления (создается автоматически)

### Формат latest.yml:

```yaml
version: 1.1.7
files:
  - url: SafeKey-Setup-1.1.7-x64.exe
    sha512: [хеш-сумма файла]
    size: [размер в байтах]
path: SafeKey-Setup-1.1.7-x64.exe
sha512: [хеш-сумма файла]
releaseDate: '2024-01-15T12:00:00.000Z'
```

**Важно:** `latest.yml` должен называться именно так - это стандартное имя для electron-updater.

---

## 🚀 Процесс создания релиза

### Шаг 1: Обновление версии

В `package.json` измените версию:
```json
"version": "1.1.7"
```

### Шаг 2: Сборка установщика

```bash
npm run build:win
```

Это создаст в папке `release/`:
- `SafeKey-Setup-1.1.7-x64.exe`
- `SafeKey-Setup-1.1.7-x64.exe.blockmap`
- `latest.yml`

### Шаг 3: Копирование latest.yml (опционально)

Для истории версий можно скопировать:
```powershell
Copy-Item release\latest.yml release\latest-1.1.7.yml
```

### Шаг 4: Создание GitHub Release

1. Перейдите на GitHub: `https://github.com/Actoric/SafeKey/releases`
2. Нажмите "Draft a new release" или "Create a new release"
3. Заполните:
   - **Tag version:** `v1.1.7` (важно: формат `v{version}`)
   - **Release title:** `SafeKey v1.1.7` или просто `v1.1.7`
   - **Description:** Описание изменений (можно использовать CHANGELOG)

### Шаг 5: Загрузка файлов

**Обязательно загрузите:**
1. `SafeKey-Setup-1.1.7-x64.exe` - установщик
2. `SafeKey-Setup-1.1.7-x64.exe.blockmap` - блок-карта
3. `latest.yml` - метаданные

**Важно:**
- Все три файла должны быть в одном релизе
- `latest.yml` должен быть в корне релиза (не в архиве)
- Имя тега должно совпадать с версией в `package.json` (с префиксом `v`)

### Шаг 6: Публикация релиза

Нажмите "Publish release"

---

## 🔧 Как работает автообновление

### Инициализация (при запуске приложения)

1. **Проверка режима:**
   ```typescript
   if (!app.isPackaged) {
     // Обновления отключены в dev/unpacked режиме
     return;
   }
   ```

2. **Настройка autoUpdater:**
   ```typescript
   autoUpdater.setFeedURL({
     provider: 'github',
     owner: 'Actoric',
     repo: 'SafeKey',
   });
   ```

3. **Автоматическая проверка:**
   - Через 5 секунд после запуска
   - Каждые 4 часа

### Процесс обновления:

1. **Проверка обновлений** (`checkForUpdates`)
   - Запрос к `https://api.github.com/repos/Actoric/SafeKey/releases/latest`
   - Сравнение версий
   - Если новая версия найдена → событие `update-available`

2. **Загрузка обновления** (`downloadUpdate`)
   - Пользователь нажимает "Обновить"
   - Загрузка `SafeKey-Setup-{version}-x64.exe`
   - Отслеживание прогресса через событие `download-progress`

3. **Установка обновления** (`installUpdate`)
   - После загрузки → событие `update-downloaded`
   - Автоматическая установка через 3 секунды
   - Закрытие всех окон и трея
   - Вызов `autoUpdater.quitAndInstall()`

### События в коде:

```typescript
// Проверка началась
autoUpdater.on('checking-for-update', () => { ... });

// Обновление найдено
autoUpdater.on('update-available', (info) => { ... });

// Обновления нет
autoUpdater.on('update-not-available', () => { ... });

// Ошибка
autoUpdater.on('error', (err) => { ... });

// Прогресс загрузки
autoUpdater.on('download-progress', (progress) => { ... });

// Загрузка завершена
autoUpdater.on('update-downloaded', (info) => { ... });
```

---

## ⚠️ Частые проблемы и решения

### Проблема 1: Обновления не находятся

**Симптомы:**
- В логах: "No update available" или "already the latest version"
- Приложение не видит новый релиз

**Причины и решения:**

1. **Неверный формат тега:**
   - ❌ Неправильно: `1.1.7`, `release-1.1.7`
   - ✅ Правильно: `v1.1.7`

2. **Версия в package.json не совпадает с тегом:**
   - В `package.json`: `"version": "1.1.7"`
   - На GitHub тег должен быть: `v1.1.7`

3. **latest.yml отсутствует или поврежден:**
   - Убедитесь, что `latest.yml` загружен в релиз
   - Проверьте, что файл не в архиве

4. **Релиз не опубликован:**
   - Релиз должен быть опубликован (не draft)
   - Проверьте: `https://github.com/Actoric/SafeKey/releases/latest`

### Проблема 2: Ошибка "Cannot find module 'electron-updater'"

**Решение:**
```bash
npm install electron-updater@^6.6.2
```

### Проблема 3: Обновление не устанавливается

**Причины:**
- Приложение не закрывается полностью
- Блокировка файлов Windows

**Решение в коде:**
```typescript
// Закрываем все окна перед установкой
if (overlayWindow) overlayWindow.destroy();
if (mainWindow) mainWindow.destroy();
if (tray) tray.destroy();

// Задержка перед установкой
setTimeout(() => {
  autoUpdater.quitAndInstall(false, true);
}, 500);
```

### Проблема 4: Обновления работают только в production

**Это нормально!** Обновления отключены в режиме разработки:
```typescript
if (!app.isPackaged) {
  console.log('Обновления отключены в dev/unpacked режиме');
  return;
}
```

Для тестирования обновлений нужно использовать собранный установщик.

### Проблема 5: Ошибка проверки цифровой подписи

**Решение:**
```typescript
// Отключаем проверку подписи (приложение не подписано)
(autoUpdater as any).verifySignatureOnUpdate = false;
```

---

## ✅ Проверка работоспособности

### 1. Проверка конфигурации

Убедитесь, что в `package.json`:
```json
{
  "version": "1.1.7",
  "build": {
    "publish": [{
      "provider": "github",
      "owner": "Actoric",
      "repo": "SafeKey"
    }]
  }
}
```

### 2. Проверка GitHub Release

1. Перейдите: `https://github.com/Actoric/SafeKey/releases/latest`
2. Убедитесь, что:
   - Тег имеет формат `v{version}` (например, `v1.1.7`)
   - Загружены все три файла:
     - `SafeKey-Setup-{version}-x64.exe`
     - `SafeKey-Setup-{version}-x64.exe.blockmap`
     - `latest.yml`
   - Релиз опубликован (не draft)

### 3. Проверка latest.yml

Откройте `latest.yml` и убедитесь:
- Версия совпадает с версией в `package.json`
- URL файла указан правильно
- SHA512 хеш присутствует

### 4. Тестирование обновления

1. Установите старую версию приложения
2. Запустите приложение
3. Дождитесь автоматической проверки (5 секунд) или нажмите "Проверить обновления" в настройках
4. Если новая версия доступна, должно появиться окно с кнопкой "Обновить"

### 5. Логи для отладки

В консоли приложения ищите сообщения:
```
[Updater] Проверка обновлений...
[Updater] Текущая версия: 1.1.6
[Updater] ✅ Доступно обновление!
[Updater] Новая версия: 1.1.7
```

---

## 📝 Чек-лист перед релизом

- [ ] Версия обновлена в `package.json`
- [ ] Установщик собран (`npm run build:win`)
- [ ] Файлы созданы в папке `release/`:
  - [ ] `SafeKey-Setup-{version}-x64.exe`
  - [ ] `SafeKey-Setup-{version}-x64.exe.blockmap`
  - [ ] `latest.yml`
- [ ] GitHub Release создан с тегом `v{version}`
- [ ] Все три файла загружены в релиз
- [ ] Релиз опубликован (не draft)
- [ ] Версия в теге совпадает с версией в `package.json`
- [ ] `latest.yml` доступен по прямой ссылке

---

## 🔗 Полезные ссылки

- **GitHub Releases:** `https://github.com/Actoric/SafeKey/releases`
- **Latest Release API:** `https://api.github.com/repos/Actoric/SafeKey/releases/latest`
- **Документация electron-updater:** `https://www.electron.build/auto-update`

---

## 💡 Важные замечания

1. **Версионирование:** Используйте семантическое версионирование (SemVer): `MAJOR.MINOR.PATCH`
2. **Теги:** Всегда используйте префикс `v` в тегах GitHub
3. **latest.yml:** Этот файл критически важен - без него обновления не работают
4. **Тестирование:** Всегда тестируйте обновления на собранной версии, не в dev режиме
5. **Безопасность:** Для production рекомендуется подписать приложение цифровой подписью

---

**Последнее обновление:** 2024  
**Версия документа:** 1.0
