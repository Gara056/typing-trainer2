# typing-trainer2

Typing practice product with an [Open Design](https://open-design.ai/) agent workflow.

## Open Design setup

This repo is ready for Cursor (and other coding agents) to design against a real brand contract:

| Piece | Path |
| --- | --- |
| Brand contract | `DESIGN.md` |
| Design system package | `design-systems/typing-trainer/` |
| Skills | `skills/frontend-design`, `skills/taste-skill` |
| Sample artifact | `artifacts/open-design/practice-screen.html` |
| Agent rules | `AGENTS.md`, `.cursor/rules/open-design.mdc` |
| MCP (Cursor desktop) | `.cursor/mcp.json` |

### 1. Install + start the local Open Design daemon

Do **not** use `npm install -g` (it writes to `/usr` and often fails with `EACCES`). Install into the repo instead:

```bash
./scripts/od-install.sh    # npm install into ./node_modules (uses nvm Node 24 if present)
./scripts/od-start.sh      # UI + API → http://127.0.0.1:7456
curl -s http://127.0.0.1:7456/api/health
```

### 2. Connect Cursor MCP

Project config in `.cursor/mcp.json` already points at the daemon. Reload MCP in Cursor, or on a full Open Design install run:

```bash
od mcp install cursor
```

### 3. Ask the agent

> Use Open Design with the typing-trainer design system and frontend-design skill. Iterate on the practice screen.

Cloud agents following `AGENTS.md` / `.cursor/rules/open-design.mdc` will read the design system and skills even when the desktop UI is not open.
