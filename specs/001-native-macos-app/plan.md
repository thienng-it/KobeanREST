# Implementation Plan: Native macOS App (`KobeanREST`)

- **Feature ID:** `001-native-macos-app`
- **Spec:** [spec.md](file:///Users/josephnguyen/Developer/KobeanREST/specs/001-native-macos-app/spec.md)
- **Threat Model:** [threats.md](file:///Users/josephnguyen/Developer/KobeanREST/specs/001-native-macos-app/threats.md)
- **Architecture Decision:** [ADR-001](file:///Users/josephnguyen/Developer/KobeanREST/docs/adr/ADR-001-native-macos-architecture.md)
- **Baseline Toolchain Verified:** `macOS 26.6.2` (`25G83`), `Xcode 26.5` (`17F42`), `Swift 6.3.2` (`arm64-apple-macosx26.0`), `/opt/homebrew/bin/xcodegen`, Rust `aarch64-apple-darwin`.

## 1. Architecture & Target Repository Layout

```text
KobeanREST/
├── Cargo.toml                         # Cargo workspace linking crates/* + src-tauri
├── crates/
│   ├── kobean-core/                   # Tauri-free Rust engine (SQLite, Keychain, HTTP, Variables, Auth, Mock, MCP, OpenAPI, Importers)
│   └── kobean-ffi/                    # UniFFI UDL / proc-macro bindings + Swift package wrapper -> libkobean_ffi.xcframework
├── src-tauri/                         # Thin Tauri v2 adapter delegating to kobean-core (keeps Windows/Linux + tests/*.test.mjs green)
└── macos/
    ├── project.yml                    # XcodeGen specification (macOS 15+ target, Hardened Runtime, Swift 6 strict concurrency)
    ├── scripts/
    │   └── build-rust-xcframework.sh  # Deterministic cargo + uniffi-bindgen -> Generated Swift + XCFramework
    ├── KobeanREST/
    │   ├── App/                       # App lifecycle, MenuBar, Commands, SettingsScene, WindowState
    │   ├── Models/                    # Identifiable / Sendable Swift view models wrapping kobean-ffi records
    │   ├── Services/                  # CoreBridge actor, OAuthSessionService (ASWebAuthenticationSession), ScriptRuntime (JavaScriptCore), WebSocketService
    │   ├── Features/
    │   │   ├── Sidebar/               # Collections, Folders, History, Environments tree
    │   │   ├── Workbench/             # Multi-tab editor, URL bar, Params/Headers/Auth/Body/Scripts tabs
    │   │   ├── Response/              # Native syntax/JSON tree/raw/headers/cookies/timing inspector
    │   │   ├── Environments/          # Variable & Keychain secret manager sheet
    │   │   ├── MockServer/            # Loopback mock route & request log inspector (Phase 3)
    │   │   └── CollectionRunner/      # Sequential/folder runner UI (Phase 3)
    │   └── Resources/                 # Assets.xcassets, Info.plist, Entitlements
    └── KobeanRESTTests/               # XCTest / Swift Testing suites (FFI bridge, JavaScriptCore, OAuth state, UI state)
```

## 2. Parallel Execution & Non-Overlapping Role Ownership

| Phase | Role Contract (`.kobean/roles/*.yaml`) | Exclusive `writes` Scope | Owned Deliverables & TDD Gate |
| :--- | :--- | :--- | :--- |
| **0 (Core Extraction)** | `backend` | `Cargo.toml`, `crates/kobean-core/**`, `src-tauri/src/**` | Extract `persistence.rs`, `secrets.rs`, `http_client.rs`, `mock_server.rs`, `spec_generator.rs`, `mcp_server.rs` into `kobean-core` taking explicit `data_dir: PathBuf` (no `tauri::AppHandle`). Verify `cargo test -p kobean-core` & `src-tauri` tests + `npm test` contracts. |
| **0 (UniFFI Bridge)** | `backend` (or second `backend` shard after core interface freezes) | `crates/kobean-ffi/**`, `macos/scripts/**` | Expose async/sync UniFFI API + `build-rust-xcframework.sh` generating `KobeanFFI.xcframework` + `KobeanFFI.swift`. Verify static linkage test in `swift test` / CLI smoke test. |
| **1 (Domain Parity)** | `data-engineer` / `backend` | `crates/kobean-core/src/domain/**` | Port `variables.ts`, `path-variables.ts`, `auth.ts` inheritance, `import-parser.ts` (cURL), and `postman-import.ts` into tested `kobean-core` modules so Swift & Tauri share identical semantics. |
| **1 (macOS Shell & MVP UI)** | `frontend` / `mobile` | `macos/project.yml`, `macos/KobeanREST/**`, `macos/KobeanRESTTests/**` | Generate Xcode project with `xcodegen`, build `NavigationSplitView` + multi-tab request editor + response viewer + environment/Keychain sheets over `CoreBridge` actor. Verify `xcodebuild test`. |
| **2 (Native OS Integrations)** | `frontend` / `mobile` | `macos/KobeanREST/Services/**`, `macos/KobeanRESTTests/**` | Implement `OAuthSessionService` (`ASWebAuthenticationSession` + PKCE/state validation in `kobean-core`) and `ScriptRuntime` (`JavaScriptCore` `JSContext` with watchdog timeout & `kb.*`/`pm.*` APIs). |
| **3 (Advanced Protocols)** | `frontend` + `backend` (non-overlapping paths) | `crates/kobean-core/src/graphql*`, `macos/KobeanREST/Features/{MockServer,CollectionRunner,WebSocket}/**` | GraphQL introspection UI, `URLSessionWebSocketTask`, Mock Server inspector, Collection Runner, MCP UI, code snippet exporter. |
| **4 (Security & Release CI)** | `security` + `devops` | `.betterleak`, `.github/workflows/macos-native.yml`, `macos/KobeanREST/Resources/*.entitlements` | Extend `.betterleak` for `.swift`/`.pbxproj`/`.xcconfig`/`.entitlements`; configure Hardened Runtime, Apple Developer ID signing + notarization + Sparkle `appcast.xml`; run `kb-review`. |

## 3. Phased Delivery & Verification Gates (Red -> Green TDD)

### Phase 0: Workspace Split & UniFFI Proof of Concept
1. **Red:** Add integration test verifying `kobean-core` opens a temporary SQLite path (`data_dir`) and runs all 11 tables + 18 column migrations without Tauri runtime, and verify `src-tauri` still satisfies `tests/*-contract.test.mjs`.
2. **Green:** Introduce workspace `Cargo.toml`, `crates/kobean-core`, and `crates/kobean-ffi`; build universal/arm64 `KobeanFFI.xcframework` + Swift bindings.
3. **Exit Gate:** `cargo test --workspace`, `npm test` (existing contract tests green), and Swift CLI/XCTest round-trips `app_contract()` + SQLite temp CRUD + Keychain mock/test scope.

### Phase 1: Shared Domain Pipeline + Native SwiftUI/AppKit REST MVP
1. **Red:** Write Rust unit tests for variable substitution (`{{var}}`, dynamic vars), path params (`:id`), auth inheritance (`folder -> collection -> request`), and cURL/Postman import parity; write Swift Testing tests for `CoreBridge` state transitions and tab lifecycle.
2. **Green:**
   - Implement shared domain modules in `crates/kobean-core`.
   - Generate `macos/KobeanREST.xcodeproj` via `xcodegen generate` (never commit brittle manual `.pbxproj` hacks).
   - Build core macOS workbench: `NavigationSplitView` sidebar (Collections/History/Envs), native `NSToolbar` / multi-tab request bar, URL + HTTP method picker, Params/Headers/Auth/Body editors, `NSLayoutManager` / `CodeEditor` or `TextEditor` monospaced JSON viewer, and status/latency/header/cookie inspector.
3. **Exit Gate:** User can open existing `kobeanrest.sqlite` (via safe read/backup fixture test), browse collections, resolve Keychain secrets, send HTTP requests, inspect responses, and save requests with zero UI freezes.

### Phase 2: Native macOS OAuth2, `JavaScriptCore` Scripts & Importers
1. **Red:** XCTests proving:
   - `OAuthSessionService` rejects mismatched `state`/callback URLs and never leaks PKCE verifier.
   - `ScriptRuntime` executes `kb.*` / `pm.*` scripts in isolated `JSContext`, blocks ObjC bridge leakage, and aborts infinite loops (`while(true){}`) within timeout.
   - Importer round-trip tests pass for cURL and Postman collections/environments.
2. **Green:** Wire `ASWebAuthenticationSession`, `JavaScriptCore` background `JSVirtualMachine` worker, and native Import/Export sheets + `NSOpenPanel`/`NSSavePanel`.
3. **Exit Gate:** Pre-request + test scripts, OAuth2 Authorization Code + PKCE, and Postman/cURL/OpenAPI import work end-to-end.

### Phase 3: GraphQL, WebSockets, Local Mock Server, MCP & Collection Runner
1. **Red:** XCTest + Rust integration tests for `URLSessionWebSocketTask`, loopback `127.0.0.1` mock server start/stop/log, GraphQL schema introspection parsing, and ordered Collection Runner execution with script assertions.
2. **Green:** Build dedicated SwiftUI inspectors and background actor coordinators; preserve `gRPC-Web` JSON parity first before evaluating binary HTTP/2 `.proto` streaming.

### Phase 4: Security Audit, Signing, Notarization & Coexistence CI
1. **Security & Contract Sync:**
   - Update `.betterleak` to scan `.swift`, `.pbxproj`, `.xcconfig`, `.entitlements`, `.plist`.
   - Verify Hardened Runtime entitlements, Keychain CDHash continuity, redacted `Logger` usage, and `threats.md` T-01..T-06 mitigations.
   - Keep `scripts/build-updater-manifest.mjs`, `scripts/check-release-preflight.mjs`, and `.github/workflows/release.yml` passing while adding separate `.github/workflows/macos-native.yml` for native DMG + Sparkle `appcast.xml`.
2. **Release Gate:** `betterleaks dir .` clean, `cargo test --workspace` green, `xcodebuild test` green, `npm test` contract suite green, notarized `.dmg` verified on clean macOS machine.

## 4. Risks & Mitigations
- **Swift <-> Rust async bridging complexity:** Keep UniFFI boundary coarse-grained (request DTO -> response DTO, repository CRUD, secret batch resolution) rather than fine-grained per-field calls.
- **Database concurrent access if Tauri & Native run simultaneously:** SQLite `WAL` mode + busy timeout in `kobean-core/persistence.rs`, plus documented single-writer recommendation when switching from Tauri to Native.
- **Existing `src-tauri/Cargo.lock` & contract regex sensitivity:** Do not alter regex-checked symbols or filenames in `src-tauri/src/` expected by `tests/*.test.mjs` without updating matching contract tests synchronously.

