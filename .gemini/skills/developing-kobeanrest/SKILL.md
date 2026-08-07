---
name: developing-kobeanrest
description: Use when building features, fixing bugs, or writing tests in the KobeanREST codebase
---

# Developing KobeanREST

## Overview
KobeanREST is a local-first desktop API client built with Tauri, React, and TypeScript. It uses SQLite for persistence. This skill outlines the critical architectures, testing conventions, and tools you MUST follow when modifying the KobeanREST codebase.

## When to Use
- Working on the KobeanREST repository.
- Fixing test failures that read `.mjs` or `assert.match` against source code.
- Implementing UI features and needing to know styling/component conventions.
- Navigating the codebase architecture.

## Codebase Navigation (CRITICAL)

**DO NOT use standard `grep`/`glob`/`find` as your first tool.**
This project integrates with a custom `code-review-graph` MCP server.

### Always use Graph Tools First:
1. `search_graph`: Find functions, classes, routes, or variables.
2. `trace_path`: Trace callers/dependencies (who calls `OrderHandler`?).
3. `get_code_snippet`: Read source code via qualified names.
4. `query_graph`: Advanced relationship tracing.

Only fallback to `grep_search` if searching for raw string literals, `.yml` workflow files, or when the graph explicitly returns no results.

## Testing Strategy (node:test)

Tests in `tests/*.test.mjs` are written using `node:test` and `node:assert`.

### The Brittle Assertion Warning
Many tests operate by reading source files (`fs.readFileSync`) and using `assert.match()` with regular expressions to verify that specific functions, constants, or syntax are present in the code.

**Common Mistake**: You refactor a TypeScript file, and tests start failing because the exact string pattern they were looking for changed.
**Fix**: If you change variable names, function signatures, or structural layout in the source code, you MUST update the corresponding `assert.match` regex strings in the `.test.mjs` files to align with your new code.

## Architecture & Conventions

### 1. Request Execution Flow
The logic for taking a `SavedRequest` and executing it is centralized.
- **Centralized Service**: `src/renderer/src/services/request-executor.ts` (specifically `prepareRequestForExecution`).
- **Flow**: Resolves scoped variables -> Evaluates Auth Inheritance -> Injects Auth Headers/Tokens -> Redacts secrets -> Sends to Tauri HTTP client.
- **DO NOT** duplicate variable resolution or auth extraction directly inside UI components.

### 2. Styling & Theming
- Do not use Tailwind or hardcoded hex colors unless explicitly required.
- **Theme Variables**: Use standard CSS variables defined in the app (e.g., `var(--color-text)`, `var(--color-border)`, `var(--color-surface-solid)`).
- **Form Controls**: Use existing KobeanREST UI components for consistency (e.g., `<CustomSelect>` instead of native `<select>`).

### 3. Persistence
- **Backend**: Managed by Rust/Tauri (`src-tauri/src/persistence.rs`).
- **Secrets**: Passwords, tokens, and secrets are NEVER stored as raw values in the database. They use the OS Keychain.

## Red Flags - STOP and Start Over
- You are using `grep_search` before trying the MCP graph tools.
- You are writing a `.test.mjs` file that tests a React component via DOM (Kobean tests source-code contracts).
- You are extracting OAuth tokens manually inside a React UI component (use the Request Executor).
- You are applying `style={{ background: '#333' }}` instead of `var(--color-surface-muted)`.
