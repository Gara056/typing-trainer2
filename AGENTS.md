# Agent guide — Typing Trainer + Open Design

Read this first when entering the repo.

## Product

`typing-trainer2` is a typing practice product. Design work must follow the brand contract in `DESIGN.md` / `design-systems/typing-trainer/`.

## Open Design

This project uses the Open Design agent-native design loop:

1. **Design system** — `design-systems/typing-trainer/` (`DESIGN.md` + `tokens.css`)
2. **Skills** — `skills/frontend-design`, `skills/taste-skill`
3. **Artifacts** — write HTML prototypes to `artifacts/open-design/`
4. **Daemon (optional)** — local Open Design ADE on port `7456`

### Start the daemon

```bash
./scripts/od-install.sh   # local npm install — never use npm install -g here
./scripts/od-start.sh
```

Requires Node 20+ (24 preferred via nvm). Packages live in `./node_modules`, not global `/usr`.

### Cursor MCP (desktop)

Project MCP config lives in `.cursor/mcp.json`. It starts `open-design-mcp` against `OD_DAEMON_URL=http://127.0.0.1:7456`.

On a machine with the full Open Design desktop/`od` CLI:

```bash
od mcp install cursor
```

### Typical design prompt

> Use Open Design + the typing-trainer design system and frontend-design skill.
> Build a high-fidelity practice screen prototype as a single HTML artifact.

## Non-goals

Do not reintroduce generic AI UI tropes banned in `DESIGN.md`.
