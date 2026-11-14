# Technical Plan: <Feature Name>

- **Plan Path:** `specs/NNN-<slug>/plan.md`
- **Spec Reference:** `specs/NNN-<slug>/spec.md`
- **Date:** `YYYY-MM-DD`

## 1. Codebase Context & Blast Radius
- **Graphify / Explorer Summary:** Key modules, entry points, and existing helpers to reuse.
- **Files to Create:**
  - `path/to/new-file.ts` — <1-line purpose>
- **Files to Modify:**
  - `path/to/existing-file.ts` — <1-line change>

## 2. Contracts & Data Model
- **API Contract (`contracts/openapi.yaml` or shared schema):** <summary of routes/types>
- **Data Model (`data-model.md` / `migrations/`):** <summary of tables, indexes, constraints>

## 3. Role Assignment & Write Ownership
| Role | Assigned Scope | Write Paths |
| :--- | :--- | :--- |
| `data-engineer` | Schema & migrations | `migrations/**`, `src/db/**` |
| `backend` | API routes & domain logic | `src/server/**`, `tests/server/**` |
| `frontend` | UI components & state | `src/web/**`, `tests/web/**` |

## 4. Verification Strategy (TDD)
- **Unit / Integration Tests:** Exact test files and assertions to write *first* (Red phase).
- **E2E / Browser Checks:** Playwright flows or `chrome-devtools-mcp` checks required.

## 5. Beads Task Graph (`.beads/`)
> Do NOT track task status in this file. Create all execution tasks and dependencies in `.beads/` using `bd create` and `bd dep add`.
- Root Epic / Bead IDs created: `<list IDs from bd>`

