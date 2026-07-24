---
title: Open Design
created: 2026-07-24
tags:
  - open-design
  - cursor
  - design
  - agent
  - typing-trainer2
source: cursor-cloud-agent
---

# Open Design

Открытая (Apache-2.0), local-first альтернатива Claude Design от [nexu-io/open-design](https://github.com/nexu-io/open-design) / [open-design.ai](https://open-design.ai/).

## Суть

Coding agent (Cursor, Claude Code, Codex и др.) становится **design engine**:

1. brief → skill + `DESIGN.md`
2. артефакт как реальные файлы (HTML / PDF / PPTX / MP4)
3. preview в sandbox / локальном daemon

Не canvas вроде Figma — а файловый цикл: skills, design systems, plugins.

## Что нужно агенту

| Слой | Роль |
| --- | --- |
| `DESIGN.md` + `tokens.css` | бренд-контракт |
| `skills/*/SKILL.md` | поведение (frontend-design, taste, …) |
| Daemon ADE (`:7456`) | API / preview / проекты |
| MCP `open-design-mcp` | инструменты из Cursor |

## Подключение к Cursor

```bash
npm i -g open-design-ade open-design-mcp   # Node 24+
./scripts/od-start.sh                      # http://127.0.0.1:7456
# или полный CLI: od mcp install cursor
```

В проекте `typing-trainer2` уже есть:

- `DESIGN.md`, `design-systems/typing-trainer/`
- `skills/frontend-design`, `skills/taste-skill`
- `.cursor/mcp.json`, `.cursor/rules/open-design.mdc`
- пример: `artifacts/open-design/practice-screen.html`

PR: https://github.com/Gara056/typing-trainer2/pull/1

## Типичный промпт

> Use Open Design with the typing-trainer design system and frontend-design skill. Build / iterate a practice screen.

## Отличие от «просто сгенерировать UI»

Без Open Design агент часто скатывается в generic AI UI. С ним вкус задаётся заранее: design system + skill + правила в `.cursor/rules`.

## Ссылки

- Сайт: https://open-design.ai/
- Cursor guide: https://open-design.ai/agents/cursor-design/
- Repo: https://github.com/nexu-io/open-design
