---
name: kb-plan
description: >-
  Architecture planning, API contract design, database schema design, and Beads
  task graph creation. Use after kb-spec (or when given clear requirements) to
  produce specs/NNN-<slug>/plan.md, contracts, data-model.md, and actionable
  issues in .beads/ using the bd CLI.
---

# `kb-plan` — Architecture, Contracts & Beads Task Graph

Distilled from **GitHub Spec-Kit** (`plan`, `tasks`, `analyze`), **Superpowers** (`writing-plans`), **Beads** (`bd` issue graph), **Addy Osmani** (`api-and-interface-design`, `documentation-and-adrs`), and **Supabase** (`postgres-best-practices`).

## Active Roles Loaded by This Skill
- [`~/.kobean/roles/architect.yaml`](../../roles/architect.yaml) *(primary)*
- [`~/.kobean/roles/api-designer.yaml`](../../roles/api-designer.yaml) *(when API routes or shared schemas change)*
- [`~/.kobean/roles/data-engineer.yaml`](../../roles/data-engineer.yaml) *(when database tables, indexes, or migrations change)*

---

## Procedure

### 1. Load Context & Spec
1. Read `specs/NNN-<slug>/spec.md` (and `threats.md` if present), `.kobean/constitution.md`, and `CONTEXT.md` / `graphify-out/GRAPH_REPORT.md`.
2. Load the relevant stack references from `.kobean/references/stacks/` (or `~/.kobean/references/stacks/`).

### 2. Design Contracts & Data Model First
- **API Contract (`api-designer`):** If client-server boundaries are touched, update or create `contracts/openapi.yaml` or shared Zod schemas in `packages/contracts/` *before* planning implementation tasks.
- **Data Model (`data-engineer`):** If persistence is touched, read stack reference `postgres-drizzle.md` and write `specs/NNN-<slug>/data-model.md` specifying tables, column types (`text`, `timestamptz`, `numeric`), foreign key indexes, and partial/GIN indexes.
- **ADRs:** If making a hard-to-reverse architectural choice, write `docs/adr/ADR-NNN-<slug>.md` using `templates/adr.md` (from `.kobean/` or `~/.kobean/`).

### 3. Write `specs/NNN-<slug>/plan.md`
Use `templates/plan.md` (from `.kobean/` or `~/.kobean/`):
- List every file to create or modify and its 1-line responsibility.
- Assign each workstream to a concrete build role (`data-engineer`, `backend`, `frontend`, `mobile`, `ml-engineer`, `devops`) with **strictly non-overlapping write paths**.
- Specify the exact failing test files and assertions each task must write first (Red phase).

### 4. Cross-Artifact Consistency Check (`speckit.analyze`)
Verify before creating tasks:
1. Every **Given/When/Then** scenario in `spec.md` maps to at least one planned component and test.
2. Every mitigation in `threats.md` maps to a concrete task and test.
3. No speculative features outside `spec.md` crept into `plan.md`.

### 5. Populate the Beads Task Graph (`.beads/` — Single Source of Truth)
> **Hard Rule:** Never create `tasks.md` or `progress.md`. Task state lives **only** in `.beads/`.

1. Initialize Beads if `.beads/` does not exist:
   ```bash
   bd init
   ```
2. Break the plan into bite-sized tasks (2–10 minutes each) and create them via `bd`:
   ```bash
   bd create "Data: <task title> [role:data-engineer] [spec:NNN]" -t task -p 1
   bd create "Backend: <task title> [role:backend] [spec:NNN]" -t task -p 1
   bd create "Frontend: <task title> [role:frontend] [spec:NNN]" -t task -p 2
   ```
3. Wire dependencies so downstream tasks cannot start before contracts/migrations finish:
   ```bash
   bd dep add <parent-blocker-id> <child-dependent-id>
   ```
4. Verify the ready queue:
   ```bash
   bd ready --json
   ```

## Verification & Handoff
Show the user the created `plan.md` link and the output of `bd ready`, then proceed to [`kb-build`](../kb-build/SKILL.md).

