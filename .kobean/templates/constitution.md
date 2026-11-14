# Project Constitution

> Established once per repository by `kb-spec` / `kb-plan`. Higher priority than default stack references in `~/.kobean/`.

## 1. Purpose & Non-Goals
- **Core Problem Solved:** <1-2 sentences>
- **Explicit Non-Goals (Never Build):**
  - <non-goal 1>
  - <non-goal 2>

## 2. Tech Stack & Runtime Constraints
- **Frontend:** TypeScript, Next.js (App Router), Tailwind CSS
- **Backend:** TypeScript, Node.js (Hono)
- **Database:** PostgreSQL + Drizzle ORM
- **Mobile (if applicable):** React Native + Expo
- **ML / AI (if applicable):** Python 3.12 + FastAPI + `uv`
- **Testing:** Vitest (unit/integration), Playwright (E2E), pytest (Python)

## 3. Architectural Invariants
1. **Contract-First:** All API changes update `contracts/openapi.yaml` or shared Zod schemas before or alongside handler changes.
2. **Migration Discipline:** Database schema changes only happen via versioned migrations in `migrations/`. Never edit existing committed migrations.
3. **Zero Secrets in Repo:** `betterleaks` must pass with 0 findings on every commit.
4. **Test-First (Red-Green-Refactor):** Every new behavior or bugfix includes an automated test that fails before the change and passes after.
5. **Ponytail Economy:** Reuse existing project helpers and installed packages before adding new dependencies.

