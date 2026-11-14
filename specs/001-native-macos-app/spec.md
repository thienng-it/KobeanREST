# Feature Specification: Native macOS App (`KobeanREST`)

- **Feature ID / Slug:** `001-native-macos-app`
- **Status:** `Draft`
- **Security / Trust Boundary:** `Yes` (OS Keychain ACLs, OAuth2 callbacks, `JavaScriptCore` script sandbox, loopback mock server, local SQLite compatibility)

## 1. Context & Ponytail Ultra Gate
- **Why this needs to exist:** Replace the Tauri/WKWebView frontend on macOS with a genuinely native SwiftUI + AppKit desktop client while preserving 100% compatibility with existing `kobeanrest.sqlite` databases, Keychain secrets (`service = "KobeanREST"`, `kobeanrest://secrets/<scope>/<key>`), HTTP execution semantics, and multi-platform (Windows/Linux) Rust engine maintenance.
- **Reusing what already exists:** Rather than rewriting 49 `rusqlite` persistence operations, Keychain CRUD (`keyring`), HTTP transport (`reqwest`), local mock server, OpenAPI stub, and MCP tool handlers from scratch, extract Tauri-free domain/data/engine modules from `src-tauri/` into `crates/kobean-core` and expose Swift bindings via `crates/kobean-ffi` (UniFFI). Keep `src-tauri/` as a thin command adapter so Windows/Linux builds and `tests/*.test.mjs` contracts remain intact.
- **Explicit v1 Cuts / Phased Deferrals:**
  - Defer binary HTTP/2 gRPC reflection (initially preserve JSON-over-HTTP gRPC-Web emulation matching `grpc-client.ts` / `proto-parser.ts`), Socket.IO client, Load Testing UI (`LoadTestModal`), Collection Encryption UI (`collection-security.ts`), AI Chat Sidebar (`AIChatSidebar.tsx`), and non-English localization (`i18n.ts` 8 locales) to Phase 3+.
  - Keep existing Tauri macOS CI/updater target (`darwin-aarch64`, `darwin-x86_64`) intact until native macOS achieves parity and a separate deprecation ADR retires Tauri macOS.

## 2. User Scenarios & Acceptance Criteria

### P1: Native Shell, Storage & Keychain Parity, Core REST Workbench
- **Scenario P1.1 — Seamless Data & Keychain Migration**
  - **Given** an existing user with SQLite data in `~/Library/Application Support/com.kobeanrest.app/kobeanrest.sqlite` and Keychain entries under service `"KobeanREST"` (`kobeanrest://secrets/<scope>/<key>`)
  - **When** they launch the native macOS app
  - **Then** collections, folders, requests, environments, history, settings, cookies, and Keychain secrets load without re-entry or schema destruction, and `persistence.rs` schema/migration invariants remain compatible across Tauri and Native builds.
- **Scenario P1.2 — Native AppKit/SwiftUI Workbench Navigation**
  - **Given** an active workspace in the macOS client
  - **When** the user navigates collections, opens multi-tab requests, edits URL/method/params/headers/auth/body, and sends requests (`Cmd+Return`)
  - **Then** the UI renders with native `NavigationSplitView`, multi-tab workbench, macOS window chrome/toolbar, keyboard shortcuts, and native dark/light appearance matching macOS HIG without WebView memory overhead.
- **Scenario P1.3 — Core HTTP Execution & Response Inspection**
  - **Given** a REST request with headers, query/path params, auth, and body
  - **When** executed via `kobean-core`
  - **Then** status code, latency, byte size, formatted JSON/XML/HTML/raw body, response headers, and cookies render accurately with sensitive headers/tokens redacted from logs and history where configured.

### P2: Variables, Auth Inheritance, OAuth2, Scripts & Import/Export
- **Scenario P2.1 — Unified Request Pipeline (`variables` + `path-variables` + `auth`)**
  - **Given** a request inside nested folders with environment variables, dynamic variables, path parameters, and inherited auth
  - **When** prepared and executed
  - **Then** pre-flight resolution yields identical effective headers, URLs, and auth credentials as `request-executor.ts`, with variable/auth resolution extracted into a shared core module (eliminating duplicated TS vs Swift logic).
- **Scenario P2.2 — Native OAuth2 Interactive Login**
  - **Given** an OAuth2 auth configuration
  - **When** the user triggers interactive login
  - **Then** macOS `ASWebAuthenticationSession` (instead of Tauri `WebviewWindowBuilder`) completes the authorization/PKCE callback safely and stores tokens in OS Keychain via `kobean-core`.
- **Scenario P2.3 — Pre-Request & Post-Response Scripts via `JavaScriptCore`**
  - **Given** a request or collection with `kb.*` / `pm.*` pre-request or test scripts
  - **When** the request runs
  - **Then** an isolated `JSContext` (`JavaScriptCore`) executes the script without Node.js or WebView, updating variables/headers/assertions deterministically within execution time limits.
- **Scenario P2.4 — Import / Export & Code Snippets**
  - **Given** cURL, Postman collection/environment, or OpenAPI 3.0 inputs
  - **When** imported or exported
  - **Then** requests/environments round-trip cleanly into `kobean-core` persistence and generate target language snippets natively.

### P3: Advanced Protocols, Mock Server, Runner & Release Distribution
- **Scenario P3.1 — GraphQL, WebSocket, Local Mock Server, MCP & Collection Runner**
  - **Given** GraphQL schema introspection, WebSocket (`URLSessionWebSocketTask`), local `127.0.0.1` mock server routes, MCP tool calls, or multi-request collection runs
  - **When** triggered from the native macOS UI
  - **Then** each subsystem operates natively with isolated state, cancellable background tasks, and test coverage.
- **Scenario P3.2 — Code Signing, Notarization, Sparkle Auto-Update & Parallel Distribution**
  - **Given** a tagged macOS release build (`darwin-aarch64` / universal or Apple Silicon-first DMG)
  - **When** built in CI
  - **Then** the `.app` / `.dmg` passes Developer ID signing, Apple notarization, secret scanning (including `.swift`, `.xcconfig`, `.entitlements`, `.pbxproj`), and publishes an independent native Sparkle `appcast.xml` without breaking Tauri's `latest.json` contract (`build-updater-manifest.mjs`).

## 3. Non-Functional Requirements
- **Minimum Supported OS & Toolchain:** Target macOS 15+ (Sequoia) or macOS 14+ (Sonoma) built with Xcode `26.5` / Swift `6.3.2` and `xcodegen` for reproducible project generation (`macos/project.yml`).
- **Performance:** Cold launch < 500ms, idle memory < 90 MB (vs multi-process WKWebView), smooth 60–120fps scrolling on 1,000+ request collections and multi-megabyte JSON responses.
- **Local-Only Invariant:** Preserve KobeanREST's local-only storage/privacy guarantees — no mandatory cloud account, telemetry, or unredacted secret writes to SQLite.
- **Strict Concurrency:** Swift 6 strict concurrency (`Sendable`, `@MainActor`, actor isolation around `kobean-core` FFI calls and `JSContext`).

## 4. Open Decisions Requiring User Confirmation Before `kb-build`
1. **Distribution Strategy (Recommended: Parallel Ship -> Later Cutover):** Ship `KobeanREST Native` alongside Tauri macOS first (`KobeanREST-macOS-Native.dmg` + Sparkle), or immediately drop Tauri macOS in `release.yml` (requires rewriting updater/release contract tests)?
2. **Minimum macOS Deployment Target (Recommended: macOS 15.0 Sequoia):** Support macOS 14.0 (Sonoma) or macOS 15.0+ (enables modern SwiftUI windowing/table APIs cleanly)?
3. **Apple Developer ID & Sparkle Keys:** Confirm whether Apple Developer ID Team ID / notarization secrets and EdDSA Sparkle keys are available in GitHub Actions or deferred to Phase 4.

