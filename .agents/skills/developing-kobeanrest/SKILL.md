---
name: developing-kobeanrest
description: Use when building features, fixing bugs, or writing tests in the KobeanREST codebase.
---

# Developing KobeanREST

## Overview
KobeanREST is a local-first desktop API client built with Tauri (Rust), React, TypeScript, and SQLite persistence. This skill outlines the critical architectures, testing conventions, and tools you MUST follow when modifying the KobeanREST codebase.

## Codebase Navigation Hierarchy
1. **Knowledge Graph First**: Use `code-review-graph` MCP tools (`semantic_search_nodes_tool`, `query_graph_tool`, `get_impact_radius_tool`).
2. **Targeted Code Search**: Fallback to `grep_search` with specific path filters (`src/renderer/src/`, `src-tauri/src/`) only if searching for string literals or `.yml` files.

## Architectural Layers & Conventions

### 1. Tauri Core & IPC Layer (`src-tauri/`)
- **Commands**: Export native functions via `#[tauri::command]` in `src-tauri/src/lib.rs` or module files.
- **Persistence**: Managed in `src-tauri/src/persistence.rs` using SQLite.
- **Secrets Management**: OAuth tokens, API keys, and passwords MUST be stored in the OS Keychain using native Rust keyring adapters. Never persist raw secrets in SQLite text columns.

### 2. Centralized Request Execution (`src/renderer/src/services/request-executor.ts`)
- **Single Source of Truth**: `prepareRequestForExecution` centralizes variable resolution, OAuth/Auth inheritance, header injection, secret redaction, and proxy configuration.
- **DO NOT** duplicate auth evaluation, environment variable replacement, or secret handling inside UI components or forms.

### 3. Styling & Modern UI System
- **CSS Design Tokens**: Use custom properties defined in `src/renderer/src/styles.css` (e.g. `var(--color-surface-muted)`, `var(--color-text)`, `var(--color-border)`).
- **No Hardcoded Hex**: Do not inject inline `style={{ background: '#1e1e1e' }}` or hardcoded hex colors.
- **Component Primitives**: Use existing UI components (`<CustomSelect>`, `<TabBar>`, `<Modal>`) for visual consistency across tabs and popups.

## Testing Strategy (`tests/*.test.mjs`)
- Tests in `tests/*.test.mjs` use `node:test` and `node:assert`.
- **Contract Test Synchronization**: Many tests inspect source code files via `fs.readFileSync` and verify structural contracts using `assert.match(code, /regex/)`.
- **Mandatory Action**: If you modify function names, signatures, constant structures, or export patterns, search `tests/*.test.mjs` and synchronously update the corresponding regex patterns to prevent false failure alarms.

## Anti-Patterns & Guardrails
- ❌ Using raw `grep_search` before attempting MCP graph tools.
- ❌ Threading layout controls (`LayoutControls`) directly inside core tab bars (`TabBar`).
- ❌ Persisting passwords, client secrets, or auth tokens as plaintext strings in SQLite.
- ❌ Adding hardcoded inline styles instead of CSS design tokens.
- ❌ Executing `git push` or non-reversible git state modifications.
