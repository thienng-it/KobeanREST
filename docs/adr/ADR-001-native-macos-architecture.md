# ADR-001: Native macOS App Architecture (`SwiftUI + AppKit` over Shared `kobean-core` via UniFFI)

- **Status:** `Accepted`
- **Date:** `2026-11-14`

## Context
KobeanREST currently ships a Tauri v2 (`kobeanrest` v0.2.0) + React/TypeScript (`WKWebView` on macOS) desktop app. The Rust layer in `src-tauri/` holds 69 `#[tauri::command]` endpoints spanning `rusqlite` persistence (11 tables, 18 schema migrations), OS Keychain (`keyring`), HTTP transport (`reqwest`), local mock server, OpenAPI stub, and MCP tool execution. Meanwhile, critical request preparation logic (`request-executor.ts`, `variables.ts`, `path-variables.ts`, `auth.ts`, `import-parser.ts`, `postman-import.ts`, `script-runtime.ts`) lives in TypeScript.

The goal is a genuinely native macOS application (`SwiftUI` + `AppKit`) with native performance, ergonomics, and macOS system integration — without fracturing database compatibility or duplicating core domain logic across Windows, Linux, and macOS.

## Options Considered
1. **Option A (Chosen): Native SwiftUI + AppKit UI (`macos/`) + Extracted Rust Core (`crates/kobean-core` + `crates/kobean-ffi` via UniFFI) + `JavaScriptCore` (`JSContext`) + `ASWebAuthenticationSession`**
   - **Pros:**
     - Zero duplication of 49 SQLite queries/migrations (`kobeanrest.sqlite`) and Keychain semantics (`service = "KobeanREST"`, `kobeanrest://secrets/<scope>/<key>`).
     - Moves TS-only domain logic (variable substitution, path params, auth inheritance, cURL/Postman parsing) into `kobean-core` so Tauri (Windows/Linux) and Native macOS share one verified engine.
     - Static XCFramework (`aarch64-apple-darwin` + optional `x86_64-apple-darwin`) links cleanly into Xcode (`xcodegen`) without runtime dylib loading issues under Hardened Runtime.
     - Uses native Apple frameworks where macOS shines: `SwiftUI` + `AppKit` UI, `ASWebAuthenticationSession` for OAuth2, `JavaScriptCore` for `kb.*`/`pm.*` scripts, `URLSessionWebSocketTask` for WebSockets, and Sparkle for native macOS auto-updates.
   - **Cons:**
     - Requires upfront extraction of Tauri types (`tauri::AppHandle`, `tauri::State`, `WebviewWindowBuilder`) out of `src-tauri/src/{persistence,http_client,secrets,mock_server,mcp_server,spec_generator}.rs` into `crates/kobean-core`.
     - Adds Rust-to-Swift UniFFI binding generation to the local/CI build step.

2. **Option B: 100% Pure Swift Rewrite (`GRDB` + `URLSession` + `Security.framework` + `NWListener`)**
   - **Pros:** Zero Rust/FFI tooling in macOS builds; smallest Xcode-only dependency graph; native `URLSessionTaskMetrics` timing breakdown.
   - **Cons:** Duplicates all 11 SQLite tables, 18 schema migrations, Keychain item format rules, HTTP execution semantics, mock server, MCP server, and OpenAPI support already maintained in `src-tauri/` for Windows/Linux — creating continuous drift risk.

3. **Option C: Keep Tauri + Native macOS Wrapper Tweaks**
   - **Pros:** Minimal effort.
   - **Cons:** Violates user requirement for a "totally native macOS app"; retains WKWebView memory overhead and web DOM rendering.

## Decision
We choose **Option A** (`SwiftUI + AppKit` UI + `crates/kobean-core` + `crates/kobean-ffi` via UniFFI) while keeping `src-tauri/` operational for Windows/Linux (and Tauri macOS during migration).

## Consequences
- **Positive:** Single source of truth for SQLite schema, Keychain secrets, HTTP engine, variables, auth inheritance, and importers; native macOS UX, memory footprint, `ASWebAuthenticationSession`, and `JavaScriptCore` execution; non-breaking coexistence with existing `tests/*.test.mjs` contract tests and Tauri releases.
- **Negative / Trade-offs:** Cargo workspace refactor (`Cargo.toml` at workspace root or `crates/`) and UniFFI XCFramework build script (`macos/scripts/build-rust-xcframework.sh`) must be maintained cleanly and tested in CI.

