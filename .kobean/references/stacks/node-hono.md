# Stack Reference: Node.js + TypeScript + Hono

> Distilled from `addyosmani/agent-skills` (`api-and-interface-design`, `observability-and-instrumentation`) and `obra/superpowers` (TDD).

## 1. Route & Schema Discipline
- **Contract-First Validation:** Use `@hono/zod-openapi` or `@hono/zod-validator` on every route (`param`, `query`, `json`, `header`). Never read raw `c.req.json()` without schema parsing.
- **Thin Handlers, Pure Domain:** Keep Hono route handlers under ~30 lines: parse input -> call domain/service function -> map result to HTTP status.
- **Typed RPC / Client Sharing:** Export `type AppType = typeof app` so Next.js and Expo clients consume end-to-end typed routes via `hc<AppType>()` or generated OpenAPI types.

## 2. Error Handling & Problem Details
- **Centralized Error Boundary:** Handle uncaught errors in `app.onError((err, c) => ...)` returning structured JSON (`{ code, message, requestId }`) without leaking stack traces in production.
- **Explicit Domain Errors:** Return typed results or throw domain-specific errors with clear HTTP status mappings (`400` validation, `401` unauthenticated, `403` unauthorized, `404` not found, `409` conflict, `422` semantic error).
- **Idempotency:** Any `POST` endpoint that charges money, sends messages, or mutates critical state must support an `Idempotency-Key` header or natural unique constraint.

## 3. Security & Observability
- **Structured Logging:** Log JSON with `requestId`, `method`, `path`, `status`, and `durationMs`. Never log tokens, passwords, raw cookies, or PII.
- **Timeouts & Cancellation:** Pass `AbortSignal.timeout(ms)` to every outbound `fetch` or third-party SDK call. Never make unbounded network calls.
- **Fail-Closed Auth:** Middleware verifies session/JWT before route handlers execute, and service functions verify resource ownership (`userId` / `orgId`) in the database query itself.

