---
name: tauri-rust-bridge
description: Develop and extend Tauri IPC commands, Rust backend state, SQLite persistence, and OS Keychain integrations. Trigger on /tauri.
---

# Tauri & Rust Core Bridge

Use this skill when modifying or extending native Rust backend features in KobeanREST (`src-tauri/`).

## Architecture & Responsibilities

1. **IPC Handlers (`src-tauri/src/lib.rs`)**:
   - Define async commands using `#[tauri::command]`.
   - Propagate typed `Result<T, String>` to JavaScript frontend.
   - Handle payload serialization/deserialization safely with `serde`.

2. **Database Persistence (`src-tauri/src/persistence.rs`)**:
   - Manage local SQLite database migrations and schema definitions.
   - Execute parameterized queries to prevent SQL injection vulnerabilities.

3. **Keychain Secrets Protection**:
   - Store API keys, passwords, and OAuth tokens exclusively in the OS Keychain (using native Rust keyring bindings).
   - Never write raw secret values into plaintext SQLite columns or unencrypted local storage.

## Validation Checklist
- Run `cargo check` inside `src-tauri/` to verify Rust code compiles without errors or warnings.
- Ensure Tauri command signatures are registered in `tauri::Builder` invoke handlers.
- Test IPC call from TypeScript renderer via `@tauri-apps/api/core`.
