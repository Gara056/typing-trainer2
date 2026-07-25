---
title: Open Design — как пользоваться в Cursor
created: 2026-07-25
tags:
  - open-design
  - cursor
  - mcp
  - how-to
  - typing-trainer2
source: cursor-cloud-agent
---

# Open Design — как пользоваться в Cursor

MCP установлен и зелёный: сервер `open-design` (`npx -y open-design-mcp`), инструменты `od_*`.

## Перед работой

В терминале репозитория:

```bash
./scripts/od-install.sh   # один раз / после clone
./scripts/od-start.sh
curl -s http://127.0.0.1:7456/api/health
# ожидаете: {"ok":true,...}
```

UI daemon: http://127.0.0.1:7456

Не использовать `npm install -g` — даёт `EACCES` на `/usr`.

## Как пользоваться

Открыть **Agent** чат в Cursor и писать обычным языком. Агент сам вызывает `od_*`.

### Примеры промптов

1. **Проект**  
   > Создай Open Design проект `typing-trainer2` с design system typing-trainer и skill frontend-design

2. **Генерация**  
   > Сгенерируй high-fidelity экран практики набора текста в Open Design. Design system: typing-trainer. Сохрани HTML в проект.

3. **Доработка**  
   > Открой проект typing-trainer2 и улучши practice screen: крупнее mono-текст, WPM/accuracy внизу, без карточек в hero

4. **Lint**  
   > Прогони lint для последнего HTML артефакта в Open Design

Стартовый промпт:  
> Сделай экран практики в Open Design с typing-trainer

## Инструменты MCP

| Tool | Зачем |
| --- | --- |
| `od_list_projects` | список проектов |
| `od_get_project` | детали + файлы |
| `od_create_project` | создать проект |
| `od_update_project` | обновить проект |
| `od_delete_project` | удалить проект |
| `od_generate_design` | сгенерировать макет (может понадобиться BYOK) |
| `od_save_project_file` | сохранить HTML в проект |
| `od_save_artifact` | сохранить глобальный артефакт |
| `od_lint_artifact` | проверить качество |
| `od_compose_brief` | собрать бриф |

## Где бренд и skills в репо

| Путь | Роль |
| --- | --- |
| `DESIGN.md` | бренд-контракт |
| `design-systems/typing-trainer/` | пакет DS + `tokens.css` |
| `skills/frontend-design`, `skills/taste-skill` | skills |
| `artifacts/open-design/` | локальные HTML-артефакты |
| `.cursor/mcp.json` | проектный MCP (если Home не нужен) |

## Чеклист «всё ок»

1. Daemon `:7456` отвечает ok  
2. В Settings → Tools & MCPs сервер `open-design` зелёный  
3. В Agent виден список `od_*`  
4. Промпт про practice screen отрабатывает  

## Связанные заметки

- [[Open Design]] — что это и как подключали
