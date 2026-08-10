# Token Saving & Execution Directives
- **CRITICAL**: Never explain the code you are writing unless explicitly asked.
- Output ONLY necessary shell commands, code edits, or concise progress summaries.
- Do not use conversational filler, greetings, or apologies (e.g. skip "Here is the code", "I understand", "Let me fix that").
- **Log & Error Parsing**: When running tests or checking logs, ALWAYS pipe output through grep to highlight failures rather than printing full logs (e.g. `npm test 2>&1 | grep -A5 -E "FAIL|ERROR"`).

# Slash Commands & Skill Triggers
Recognize and immediately activate corresponding skills when the user executes slash commands:
- `/code-review` or `/review`: Activates `code-review` / `review-changes` skill for risk-scored code review.
- `/compact` or `/summarize`: Activates `compact` skill to summarize context, save persistent state to artifacts, and minimize token usage.
- `/debug`: Activates `debug-issue` skill for log-first systematic debugging.
- `/explore`: Activates `explore-codebase` skill for graph architecture exploration.
- `/refactor`: Activates `refactor-safely` skill for impact-checked refactoring.
- `/tauri`: Activates `tauri-rust-bridge` skill for Tauri IPC, SQLite, and OS Keychain development.
- `/ai-pipeline`: Activates `ai-pipeline-integration` skill for automated CI/CD pipeline management.

# Context & Memory Compaction Protocol
- When handling `/compact`, extract all active architectural decisions, modified file paths, and pending verifications.
- Persist structured state into project artifacts (`implementation_plan.md` or `walkthrough.md`) to maintain continuity across sessions.
- Provide a token-dense summary snapshot and clear current task queue.

# Codebase Architecture & System Boundaries
- **Tauri / Rust Core (`src-tauri/`)**: Handles window management, SQLite database persistence (`persistence.rs`), OS Keychain secrets management, and native HTTP request dispatching.
- **React UI Renderer (`src/renderer/`)**: TypeScript & React UI layer. Styled using custom CSS variables (e.g. `var(--color-surface-muted)`). Avoid hardcoded hex colors or inline style hacks.
- **Request Execution Engine (`src/renderer/src/services/request-executor.ts`)**: Centralizes variable resolution, OAuth/Auth inheritance, header injection, and secret redaction. Never duplicate auth logic in UI components.
- **VSCode Extension Suite (`vscode-extension/`)**: Standalone extension for KobeanREST integration inside VSCode.

# MCP & Knowledge Graph Navigation
- **Primary Exploration**: ALWAYS use `code-review-graph` MCP tools (`semantic_search_nodes_tool`, `query_graph_tool`, `get_impact_radius_tool`, `detect_changes_tool`) before using raw search tools.
- **Token Efficiency**: Target completing review/debug tasks in ≤5 tool calls and ≤800 tokens. Start with `get_minimal_context` and `detail_level="minimal"`.
- **Search Fallback**: Use `grep_search` only if searching for raw string literals, `.yml` pipeline files, or when the knowledge graph returns no results.

# Testing & Contract Synchronization
- **Contract Tests (`tests/*.test.mjs`)**: Contract tests use `node:test` and read source code via `fs.readFileSync` with `assert.match()` regex patterns.
- **Synchronous Updates**: When refactoring functions, parameters, or constants, search `tests/*.test.mjs` and synchronously update regex assertions to prevent false positive contract test failures.
- **CI Synchronization**: Sync `.github/workflows/*.yml` step names, runner versions, and concurrency groups with contract test assertions.

# Component Boundaries & Security Safety Directives
- **Layout Decoupling**: Keep layout controls (`LayoutControls`) decoupled from core tab navigation (`TabBar`). Compose toolbars in parent containers rather than threading layout props through tab bars.
- **Secrets Protection**: Credentials and tokens MUST use OS Keychain integration via Rust (`persistence.rs`). Never store secrets in plaintext SQLite fields or local state.
- **Git Safety**: NEVER execute `git push`, `git reset --hard`, or destructive branch manipulations unless explicitly instructed by the user.
