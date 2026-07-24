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

### 1. Start the local Open Design daemon

```bash
npm install -g open-design-ade open-design-mcp   # Node 24+
./scripts/od-start.sh
# UI + API → http://127.0.0.1:7456
```

### 2. Connect Cursor MCP

Project config in `.cursor/mcp.json` already points at the daemon. Reload MCP in Cursor, or on a full Open Design install run:

```bash
od mcp install cursor
```

### 3. Ask the agent

> Use Open Design with the typing-trainer design system and frontend-design skill. Iterate on the practice screen.

Cloud agents following `AGENTS.md` / `.cursor/rules/open-design.mdc` will read the design system and skills even when the desktop UI is not open.
