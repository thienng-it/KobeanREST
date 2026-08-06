# 🛡️ Security & Privacy Blueprint Specification

Security, data sovereignty, and user privacy are fundamental engineering constraints in KobeanREST's system architecture.

---

## 🔒 Security Architecture Guarantees

> [!IMPORTANT]
> **Zero Telemetry Guarantee:**  
> KobeanREST makes zero outbound calls to tracking backends, license verification servers, or analytics endpoints. All data processing occurs on local developer hardware.

### 1. Keychain Vault Integration
Sensitive credentials (API tokens, OAuth client secrets, password fields) are isolated from local database files:
- Stored directly in native platform keychains (macOS Keychain, Windows Credential Manager, Linux Secret Service API).
- SQLite database tables only store redacted secret metadata placeholders (`[SECRET:key_id]`).

### 2. Local AI Privacy Protection
- All AI chat interactions take place strictly over local loopback (`http://localhost:11434`) using host-installed Ollama models.
- No request parameters, API keys, tokens, or response bodies are sent to external cloud AI services.

### 3. Environment Guardrails & Color Badging
- Environments feature custom visual color badges (Red/Amber for Production, Yellow for Staging, Blue/Green for Dev) to highlight dangerous targets and prevent accidental execution on production APIs.

### 4. Sensitive Log Redaction Engine
- Request history automatically redacts query parameter values containing sensitive keys (`token`, `key`, `auth`, `secret`, `password`).
- Redaction runs before persisting history records to SQLite.

### 5. Cryptographic Ed25519 Auto-Updater Signing
- Releases published on GitHub Releases are cryptographically signed using Ed25519 private keys in CI.
- KobeanREST desktop binaries verify signature authenticity against a pinned public key before installing any update package.

### 6. Continuous Secret Leak Scanning (`npm run check:secrets`)
- CI runs `Betterleak` preflight scans on every commit to prevent accidental commitment of credentials, tokens, or private keys.
