# Публикация релиза (PC, electron-updater)

## Версия

Обновите `version` в корневом `package.json` и в `src/main/config/app.config.ts` перед сборкой.

## Сборка Windows

```bash
npm install
npm run build:win
```

Артефакты в `release/`:

- `SafeKey-Setup-x64.exe` — установщик  
- `latest.yml` — метаданные для electron-updater (обязателен)

### Если сборка падает на `winCodeSign` / symbolic link

На Windows без прав администратора старые версии `7zip` в electron-builder ломают распаковку. В проекте зафиксирован **`electron-builder@24.6.3`** (обход). Альтернативы: **PowerShell от имени администратора** или **режим разработчика** Windows (Параметры → Для разработчиков).

## Загрузка в GitHub Release

Нужен доступ к репозиторию (один раз):

```powershell
gh auth login
```

После `npm run build:win`:

```powershell
.\scripts\upload-release.ps1
```

Скрипт загрузит `release\SafeKey-Setup-x64.exe` и `release\latest.yml` в релиз с тегом `v1.2.2`.

Либо вручную: **Releases → нужный тег → Edit → прикрепить файлы**.

## GitHub Release

1. Создайте тег: `git tag v1.2.2` и `git push origin v1.2.2` (или через UI GitHub).
2. В **Releases** загрузите:
   - установщик (`.exe` / NSIS),
   - **`latest.yml`** — обязателен для `electron-updater` (генерируется при publish или лежит рядом с билдом).

Без корректного `latest.yml` в релизе клиент не сможет определить новую версию.

## Проверка

Установленная сборка должна подхватить обновление при следующей проверке (см. `src/main/updater/github-updater.ts`).
