# KobeanREST Project Constitution

## 1. Local Architecture & Hard Boundaries
- **Tauri / Rust Core (`src-tauri/`):** Window management, SQLite persistence (`persistence.rs`), OS Keychain secret storage, native HTTP dispatching. Never store secrets in plaintext SQLite or local state.
- **React UI Renderer (`src/renderer/`):** TypeScript + React UI styled with CSS custom properties (`var(--color-*)`). Avoid hardcoded hex colors or inline style hacks. Keep `LayoutControls` decoupled from `TabBar`.
- **Request Execution Engine (`src/renderer/src/services/request-executor.ts`):** Single owner for variable resolution, auth inheritance, header injection, and secret redaction.
- **VS Code Extension (`vscode-extension/`) & Docs Site (`docs-site/`):** Standalone packages; keep builds and tests independent.
- **Contract Tests (`tests/*.test.mjs`):** Assert on source patterns via regex (`assert.match`). Synchronize contract assertions whenever refactoring symbols, parameters, or CI workflows.

## 2. Engineering Workflow & Tooling Rules
- **Ponytail Economy (`.agents/skills/ponytail/SKILL.md`, `.kobean/doctrine.md` §3):** Reuse existing helpers first, write the smallest complete change, avoid speculative abstractions/flags, and end build/review responses with 1–2 lines noting skipped scope and residual risk.
- **UI/UX Craft (`kb-ui`, `taste-skill`, `ui-ux-pro-max`):** Follow `.kobean/references/design/impeccable-taste.md` (Impeccable default; opt-in `bold` via `.agents/skills/taste-skill/`; `ui-ux-pro-max` §5 pairings as lookup reference only) while respecting KobeanREST CSS tokens.
- **`.beads/` (`bd`) Task State:** Always check `bd ready --json`, claim (`bd update <id> --status in_progress`), add/link subtasks as discovered, and close (`bd close <id>`) completed items. Never create `tasks.md` or `progress.md`.
- **`graphify` (`graphify-out/`) & `code-review-graph` MCP:** Read `graphify-out/GRAPH_REPORT.md` / run `graphify query` and use `code-review-graph` MCP tools before broad raw greps. After building or modifying code, run `graphify update . >/dev/null 2>&1 || true` so the graph stays current.
- **Simultaneous Subagent Orchestration:** For non-trivial builds or modifications, operate as coordinator and dispatch multiple `.kobean/roles/*.yaml` subagents in parallel with strictly non-overlapping `writes` paths; run independent read, implementation, review, security, and QA slices concurrently.

