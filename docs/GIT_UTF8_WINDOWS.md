# Git и кириллица на Windows (без «иероглифов» на GitHub)

## Уже сделано в этом репозитории

В каталоге проекта выполнено:

```powershell
git config core.quotepath false
git config i18n.commitEncoding utf-8
git config i18n.logOutputEncoding utf-8
```

## Глобально для всех репозиториев (рекомендуется)

```powershell
git config --global core.quotepath false
git config --global i18n.commitEncoding utf-8
git config --global i18n.logOutputEncoding utf-8
```

Перед коммитом в **PowerShell** можно включить UTF-8 для консоли:

```powershell
chcp 65001
```

## Сообщения коммитов

Для релизов используйте **латиницу**, например: `Release v1.2.2`, `fix: tray`, `docs: readme`.

## Старая история

Сообщения уже отправленных коммитов на GitHub **не меняются** сами. Исправить их можно только переписыванием истории (`git filter-repo`), что ломает клоны у других. Новые коммиты с правильной кодировкой и английскими сообщениями отображаются нормально.
