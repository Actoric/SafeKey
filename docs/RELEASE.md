# Публикация релиза (PC, electron-updater)

## Версия

Обновите `version` в корневом `package.json` и в `src/main/config/app.config.ts` перед сборкой.

## Сборка Windows

```bash
npm install
npm run build:win
```

Артефакты обычно в `release/` (см. `electron-builder` в `package.json`).

## GitHub Release

1. Создайте тег: `git tag v1.2.2` и `git push origin v1.2.2` (или через UI GitHub).
2. В **Releases** загрузите:
   - установщик (`.exe` / NSIS),
   - **`latest.yml`** — обязателен для `electron-updater` (генерируется при publish или лежит рядом с билдом).

Без корректного `latest.yml` в релизе клиент не сможет определить новую версию.

## Проверка

Установленная сборка должна подхватить обновление при следующей проверке (см. `src/main/updater/github-updater.ts`).
