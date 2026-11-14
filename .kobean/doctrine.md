# KobeanSkills — Engineering Doctrine & Precedence Rules

This document is the binding constitution for all `kb-*` skills and the 22 role contracts in `KobeanSkills`. Whenever instructions from different upstream inspirations clash, this hierarchy wins.

---

## 1. Authority Hierarchy (Highest to Lowest)

1. **Explicit User Instructions** in the active chat turn.
2. **Project Constitution** (`.kobean/constitution.md` in the target repository, if present).
3. **Kobean Doctrine** (this file: `.kobean/doctrine.md` or `~/.kobean/doctrine.md`).
4. **Active Role Contract** (`.kobean/roles/<role>.yaml` or `~/.kobean/roles/<role>.yaml` — specifically its `writes`, `forbidden`, and `done_when` rules).
5. **Entry Skill Procedure** (`skills/kb-*/SKILL.md`).
6. **Stack & Design Reference Checklists** (`.kobean/references/**` or `~/.kobean/references/**`).

---

## 2. Single Owner Per Concern (Conflict Resolution)

| Concern | Single Owner | Forbidden Competing Patterns |
| :--- | :--- | :--- |
| **Requirements & Scope** | `specs/NNN-<slug>/spec.md` (Spec-Kit format + OpenSpec `ADDED`/`MODIFIED`/`REMOVED` deltas for brownfield changes) | Ad-hoc requirements scattered in chat or `TODO.md`. |
| **Architecture & Contracts** | `specs/NNN-<slug>/plan.md` + `contracts/openapi.yaml` + `data-model.md` | Undocumented schema/API inventions during coding. |
| **Task State & Dependencies** | **Beads (`.beads/` via `bd`) ONLY** | Never create `tasks.md`, `progress.md`, or markdown task checklists to track execution state. |
| **Codebase Orientation** | **`graphify`** (`graphify-out/GRAPH_REPORT.md` & `graph.json`) + `CONTEXT.md` | Blindly running dozens of broad `grep`/`find` loops before checking the structural graph. |
| **Execution Loop** | **Superpowers SDD + Red-Green-Refactor TDD** | Writing implementation code before a failing test or self-check exists. |
| **Code Economy (Build/Review)** | **Ponytail Full Mode** (smallest complete change) | Speculative abstractions, wrappers, unused config flags, or dependencies added for a few lines. |
| **UI/UX Craft** | **Impeccable** (default) + **Taste-Skill** (opt-in `bold` mode only) | Generic "AI slop" (see Section 4). `ui-ux-pro-max` palettes/styles are lookup references only and never override Impeccable bans. |
| **Browser Inspection** | **Native `chrome-devtools-mcp`** + installed Antigravity plugins (`modern-web-guidance`, `a11y-debugging`, `debug-optimize-lcp`) | Third-party Node/Puppeteer scraping scripts from upstream repos. |

---

## 3. Phase-Scoped Ponytail (YAGNI) Policy

Ponytail's "lazy senior developer" philosophy is **phase-dependent**:

- **OFF in `kb-spec` and `kb-plan` (`architect`, `api-designer`, `threat-modeler`):**
  Specs, threat models, and architectural plans must be thorough, explicit about edge cases, and unambiguous. However, the **PO (`po`)** role runs a single **Ponytail Ultra gate** at the start of `kb-spec`: *"Does this feature need to exist at all, or does an existing mechanism already solve it?"*
- **ON (Full Mode) in `kb-build`, `kb-debug`, and `kb-review`:**
  1. Reuse what is already in the codebase -> standard library -> already-installed dependency. Never add a new package for a few lines of logic.
  2. Write the **smallest complete change** that satisfies `spec.md` and `plan.md`, including callers, tests, and fixtures.
  3. Zero speculative abstractions, "for later" hooks, or unrequested options.
  4. Mark intentional shortcuts with `// shortcut: <limit>, <when to upgrade>`.
  5. End every build/review response with **1–2 lines**: what was intentionally skipped and any residual risk.
  6. **Never cut:** validation at trust boundaries, error handling that prevents data loss, security, accessibility, or anything explicitly in `spec.md`.

---

## 4. UI/UX Hard Bans (Impeccable + Taste Doctrine)

When `kb-ui` or `frontend` builds or reviews any interface:
1. **Hard Bans (AI Slop):**
   - No default unstyled Inter/Roboto with generic indigo/purple-to-blue gradients on dark cards.
   - No mechanical 3-equal-icon-card rows with generic marketing filler copy.
   - No broken images, empty visual placeholders, or unaligned left/right container edges.
   - No `:focus` without `:focus-visible`, no missing keyboard navigation, no contrast below WCAG AA.
2. **Default Mode (Impeccable):**
   - Read or create `PRODUCT.md` first (audience, tone, typographic scale, color tokens, anti-patterns).
   - Deliberate hierarchy, high-contrast typography, purposeful spacing, and complete states (loading, empty, error, success).
3. **`bold` Mode (Taste-Skill — triggered when user asks for `bold`, landing page, or high-craft brand site):**
   - One section per screen rhythm (hero alone on first viewport at `1440x900`).
   - Equal left and right content edges across all sections.
   - One hero entrance (`data-enter`) + 1–2 dealt visual moments per page; subtle hover micro-interactions (2px card lift, 1.02 photo zoom inside frame).
   - No captions under visuals (credits in one footer line).

---

## 5. Subagent & Role Isolation Rules (Antigravity-First)

1. **Strict Write Ownership:**
   Every role in `roles/<role>.yaml` declares `writes` and `forbidden` globs. No two build roles write to the same file path simultaneously. If `backend` needs a migration change, it hands off to `data-engineer`. If `frontend` needs a CI change, it hands off to `devops`.
2. **How to Spawn a Role Subagent:**
   - **On Antigravity:** Use `invoke_subagent(TypeName="self", Role="<Role Title>", Prompt="...")` for roles that write files or run commands, and `invoke_subagent(TypeName="research", Role="<Role Title>", Prompt="...")` for read-only discovery roles (`explorer`).
   - **On Claude Code:** Use the `Agent` / `Task` tool with the role contract embedded in the prompt.
   - **On Codex CLI:** Dispatch role subagents or load `.kobean/roles/<role>.yaml` as the binding role contract for the execution turn.
   - Every subagent prompt **must** include: (a) path to `.kobean/roles/<role>.yaml` (or `~/.kobean/roles/<role>.yaml`), (b) path to `.kobean/doctrine.md` (or `~/.kobean/doctrine.md`), (c) exact target files/Beads issue ID, and (d) required output contract.
3. **Hard Completion Gates:**
   Work is **blocked from shipping** if any of the following fail:
   - `betterleaks` detects any secret in the working tree or git history.
   - `reviewer` or `security` reports any `CRITICAL` or `HIGH` finding (verified via Trail of Bits `fp-check` false-positive gate).
   - `qa` reports any failing acceptance criterion from `spec.md` or failing test suite.

