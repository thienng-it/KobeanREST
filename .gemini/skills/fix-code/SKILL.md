---
name: fix-code
description: Fix bugs, CI failures, and TypeScript lint errors based on repository-specific contracts and empirical logs. Trigger on /fix or /fix-code.
---

# Systematic Code Repair Workflow (`/fix`, `/fix-code`)

Use this skill when the user types `/fix` or `/fix-code` to systematically diagnose and resolve build failures, runtime errors, or test regressions in KobeanREST.

## Learned Repository Repair Protocol

### 1. Empirical Log Inspection First
- **Never Guess**: Fetch exact failure output before forming a diagnostic hypothesis.
- **Piped Grep Filtering**:
  - Main renderer / contract tests: `npm test 2>&1 | grep -A5 -E "FAIL|ERROR"`
  - VS Code extension linting: `npm --prefix vscode-extension run lint 2>&1 | grep -A5 -E "error TS"`
  - VS Code extension build: `npm --prefix vscode-extension run build:prod`

### 2. TypeScript & Strict Mode Rules
- **Unused Parameters/Variables**: Prefix unused arguments with `_` or remove unused class property declarations when `noUnusedLocals` / `noUnusedParameters` is enabled.
- **Interface Alignment**: Ensure all required interface properties (e.g. `CommandDependencies`) are supplied in call sites.
- **Safe Casts**: Convert symbols to `unknown` first before casting across non-overlapping interfaces.

### 3. Synchronous Contract Test Synchronization (`tests/*.test.mjs`)
- Tests in `tests/*.test.mjs` match source code regexes using `fs.readFileSync` and `assert.match()`.
- Whenever modifying source function signatures, constants, or exports, search `tests/*.test.mjs` and update corresponding regex assertions.

### 4. Component Boundaries & Security Standards
- **Keychain Isolation**: Secrets (OAuth tokens, API keys) MUST use OS Keychain (`persistence.rs`). Never write plaintext secrets to SQLite text columns.
- **CSS Design Tokens**: Use `var(--color-surface-muted)` instead of hardcoded hex values.
- **Layout Decoupling**: Keep `LayoutControls` decoupled from `TabBar`.

### 5. Verification & Conventional Commits
- Run build/test verification commands.
- Stage changes cleanly (`git add .`).
- Use Conventional Commits format (`fix(scope): description`).

## Token Budget & Constraints
- Maximum 5 tool calls.
- High signal-to-noise response without conversational filler.
