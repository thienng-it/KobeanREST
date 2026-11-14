# Security & Vulnerability Audit Checklist

> Distilled from `trailofbits/skills` (`differential-review`, `insecure-defaults`, `sharp-edges`, `fp-check`, `agentic-actions-auditor`), OWASP Top 10, and `betterleaks`.

## 1. Mandatory Automated Gates (Run First)
1. **Secrets Gate (`betterleaks`):**
   - Run `betterleaks git -v` (or `betterleaks dir . -v` if uncommitted).
   - **Rule:** Any verified secret or hardcoded credential is an immediate `CRITICAL` blocker.
2. **Static Analysis (`semgrep` if installed):**
   - Run `semgrep scan --config auto --error` on modified paths.

## 2. Trail of Bits Audit Lenses

### A. Differential Review (Blast Radius on Diffs)
- Trace every modified function's callers and callees.
- Did a trust assumption change? (e.g., an internal helper assuming pre-validated input is now called from a public route).
- Did error handling or early returns change in a way that skips cleanup or auth checks?

### B. Insecure Defaults & Fail-Open Traps
- **Fail-Open Checks:** What happens if an env var (`JWT_SECRET`, `WEBHOOK_SECRET`, `CORS_ORIGIN`) is `undefined` or empty? Code must throw at startup, never fall back to `""` or `"*"`.
- **Permissive Defaults:** Are CORS, cookie flags (`HttpOnly`, `Secure`, `SameSite=Lax|Strict`), or file permissions permissive by default?

### C. Sharp Edges & Footguns
- **Broken Access Control (IDOR):** Does every read/update/delete query filter by the authenticated principal's `userId`/`tenantId` in SQL, or only check `id`?
- **Injection:** Are any SQL strings, shell commands (`child_process.exec`), or HTML templates (`dangerouslySetInnerHTML`) constructed via string concatenation?
- **Cryptography & Timing:** Are webhook signatures or tokens compared using `crypto.timingSafeEqual`? Are random tokens generated via `crypto.randomBytes` / `crypto.randomUUID` (never `Math.random`)?
- **SSRF & Unbounded Input:** Can user-supplied URLs reach internal networks (`127.0.0.1`, `169.254.169.254`)? Are request body and file upload sizes strictly capped?

### D. CI/CD & Agentic Actions Security (`agentic-actions-auditor`)
- Never interpolate untrusted GitHub event fields (`${{ github.event.issue.title }}`, `pull_request.body`, `head_ref`) directly inside `run:` shell blocks—pass them via `env:` variables.
- Pin third-party GitHub Actions to full commit SHAs and set minimal `permissions: contents: read`.

## 3. False-Positive Verification Gate (`fp-check`)
Before reporting any `CRITICAL` or `HIGH` finding:
1. Trace the exact data flow from **untrusted source** (HTTP input, webhook, file) to **sensitive sink** (DB, shell, DOM, auth decision).
2. Check if upstream middleware, schema validation (Zod/Pydantic), or framework auto-escaping already neutralizes it.
3. Include a concrete reproduction or exploit scenario for every reported `CRITICAL`/`HIGH` issue. Drop speculative noise.

