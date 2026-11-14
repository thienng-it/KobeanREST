# Threat Model: <Feature / System Name>

- **Path:** `specs/NNN-<slug>/threats.md`
- **Methodology:** STRIDE + DREAD + Trail of Bits Sharp-Edges / Insecure-Defaults

## 1. Assets & Trust Boundaries
- **Critical Assets:** (e.g., session tokens, PII, payment webhooks, API keys)
- **Entry Points:** (e.g., public REST routes, file uploads, OAuth callbacks, CI workflows)
- **Trust Boundaries:** Browser <-> Edge API <-> Internal Service <-> PostgreSQL / 3P APIs

## 2. STRIDE Matrix & Mitigations

| ID | Category (S/T/R/I/D/E) | Component / Entry Point | Threat Description | DREAD (1-10) | Required Mitigation (Must be tested in QA) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| T-01 | Spoofing | Auth callback | ... | 8 | ... |
| T-02 | Tampering | Webhook handler | Missing HMAC signature verification | 9 | Verify raw body HMAC with constant-time compare |

## 3. Insecure Defaults & Sharp Edges Checklist
- [ ] Fails closed on missing auth/config (never fail-open).
- [ ] Rate limiting and payload size limits defined on all public endpoints.
- [ ] Secrets loaded exclusively from environment/secret manager, never defaulted in code.
- [ ] Authorization checked at the data/resource layer (IDOR prevention), not just route middleware.

