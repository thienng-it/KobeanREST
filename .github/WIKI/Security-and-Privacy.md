# 🛡️ Security & Privacy Blueprint

Security and user privacy are foundational constraints in KobeanREST's architecture.

---

## 🔒 Security Architecture Guarantees

### 1. Keychain Vault Integration
Sensitive credentials (API tokens, OAuth client secrets, password fields) are isolated from local database backups:
- Stored directly in native platform keychains (macOS Keychain, Windows Credential Manager, Linux Secret Service API).
- SQLite database tables only store redacted secret metadata placeholders (`[SECRET:key_id]`).

### 2. Zero-Telemetry & Offline Isolation
- KobeanREST makes zero outbound calls to analytics servers, tracking APIs, or license verification backends.
- Request history automatically redacts query parameter values containing sensitive keys (`token`, `key`, `auth`, `secret`, `password`).

### 3. Release Verification & Updater Public Key Signing
- Releases published on GitHub Releases are signed using Ed25519 private keys in CI.
- KobeanREST desktop binary verifies the cryptographic signature of updater manifests against a pinned public key before installing updates.

### 4. Continuous Secret Leak Scanning (`npm run check:secrets`)
- CI runs `Betterleak` preflight scans on every commit to prevent accidental commitment of credentials or private keys.
