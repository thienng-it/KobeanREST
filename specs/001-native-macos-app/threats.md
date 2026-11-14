# Threat Model: Native macOS App (`KobeanREST`)

- **Path:** `specs/001-native-macos-app/threats.md`
- **Methodology:** STRIDE + DREAD + Trail of Bits Sharp-Edges / Insecure-Defaults

## 1. Assets & Trust Boundaries
- **Critical Assets:** OS Keychain secrets (`service = "KobeanREST"`, `kobeanrest://secrets/<scope>/<key>`), OAuth2 access/refresh tokens & PKCE verifiers, SQLite database (`kobeanrest.sqlite`), workspace collections/requests/headers, developer signing keys & Sparkle EdDSA update keys.
- **Entry Points:** UniFFI boundary (`Swift <-> kobean-ffi <-> kobean-core`), `ASWebAuthenticationSession` OAuth2 callback URLs, custom URL schemes, imported cURL/Postman/OpenAPI payloads, `JavaScriptCore` (`JSContext`) user/workspace scripts, loopback HTTP mock server (`127.0.0.1`), Sparkle updater feed.
- **Trust Boundaries:**
  - `SwiftUI/AppKit UI <-> kobean-ffi (Rust)`
  - `kobean-core <-> OS Keychain & SQLite`
  - `KobeanREST App <-> JavaScriptCore Sandbox`
  - `KobeanREST App <-> ASWebAuthenticationSession / Remote APIs`
  - `Local Loopback Mock Server <-> Localhost Processes / Browser`

## 2. STRIDE Matrix & Mitigations

| ID | Category (S/T/R/I/D/E) | Component / Entry Point | Threat Description | DREAD (1-10) | Required Mitigation (Must be tested in QA) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| T-01 | Spoofing | `ASWebAuthenticationSession` OAuth2 callback | Malicious app claims custom callback scheme or injects forged `code`/`state` parameter. | 8 | Validate strict CSRF `state` and PKCE `code_verifier` inside `kobean-core`; prefer HTTPS universal/ephemeral session isolation and reject mismatched redirect URLs. |
| T-02 | Elevation / Info Disclosure | OS Keychain ACLs & Code Signing Identity | Unsigned/ad-hoc native macOS builds change CDHash on every build or share Keychain items insecurely across bundle IDs; secret leaked into SQLite/logs. | 8 | Keep Keychain writes strictly inside `kobean-core` (`secrets.rs`), sign local dev/CI builds consistently, enforce secret-redaction filter before writing SQLite history or OSLog, and assert zero plaintext secrets in `.sqlite` tests. |
| T-03 | Tampering / Elevation | `JavaScriptCore` (`JSContext`) pre/post script runner | Malicious shared Postman/collection script accesses Objective-C runtime bridges, environment variables, or blocks main/UI thread indefinitely (`while(true)`). | 8 | Run scripts in an ephemeral `JSContext` inside a dedicated background `JSVirtualMachine` with no Cocoa/ObjC class exports, explicit watchdog termination timeout + exception handler, and scoped `kb.*`/`pm.*` read-only/allowlisted mutation APIs. |
| T-04 | Tampering / SSRF / DNS Rebinding | Loopback Mock Server (`mock_server.rs`) & HTTP Executor | Mock server accidentally binds `0.0.0.0` exposing local machine, or imported malformed spec triggers oversized allocation / local host bypass. | 7 | Bind strictly to `127.0.0.1` (loopback only), enforce request/response body size limits, and sanitize path/header inputs from imported Postman/OpenAPI/cURL files. |
| T-05 | Information Disclosure | SQLite Database & Backup / Crash Logs | Imported collections, cookies, or resolved headers containing resolved tokens are persisted in plaintext history or leaked to macOS Console (`OSLog` without `.private`). | 8 | Redact `Authorization`, `Cookie`, API key headers, and resolved `kobeanrest://secrets/...` values prior to SQLite history persistence; mark dynamic log interpolations `private` in `Logger`. |
| T-06 | Tampering (Supply Chain) | GitHub Actions macOS Build + Sparkle Update Feed | Unsigned DMG or compromised `appcast.xml` serves tampered binary to auto-update users; Swift/Xcode files bypass `.betterleak` secret scan. | 9 | Require Developer ID signing + notarization + Sparkle EdDSA signature verification for distribution; extend `.betterleak` / `check:secrets` coverage to `.swift`, `.pbxproj`, `.xcconfig`, `.entitlements`, and CI workflow vars. |

## 3. Insecure Defaults & Sharp Edges Checklist
- [ ] **Fail closed on OAuth / Keychain errors:** Missing or locked Keychain item returns structured typed error to UI — never silently sends literal `kobeanrest://secrets/...` reference or empty string as an unredacted header unless explicitly configured.
- [ ] **Zero App Transport Security (ATS) wildcard relaxation:** Do not enable `NSAllowsArbitraryLoads` globally unless explicitly scoped/justified for local API development testing (`NSAllowsLocalNetworking` preferred for localhost APIs; user-configurable TLS validation warnings in HTTP client).
- [ ] **Hardened Runtime & Minimal Entitlements:** Enable Hardened Runtime (`ENABLE_HARDENED_RUNTIME = YES`) with `com.apple.security.network.client` and `com.apple.security.network.server` (only if mock server enabled); avoid disabling library validation unless required by bundled dylibs (prefer static Rust `libkobean_ffi.a` XCFramework!).
- [ ] **No ObjC reflection exposure in `JSContext`:** Never expose `AppKit`/`Foundation` objects directly to `JSContext`; marshal only plain JSON/String DTOs across the script bridge.
- [ ] **CI & Secret Hygiene:** Extend `.betterleak` before writing Swift/Xcode config files so certificates, provisioning profiles, `.p12`, `.mobileprovision`, `.xcconfig`, and Sparkle private keys can never be committed.

