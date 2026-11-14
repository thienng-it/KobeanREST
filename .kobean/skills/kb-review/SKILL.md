---
name: kb-review
description: >-
  Multi-role verification gate combining Ponytail code review, Trail of Bits
  security auditing, betterleaks secret scanning, osv-scanner supply-chain
  checks, Core Web Vitals performance, WCAG 2.2 accessibility, and QA acceptance
  testing. Use after kb-build or when asked to review a diff, PR, or repository.
---

# `kb-review` — Code Review, Security, Perf, A11y & QA Gate

Distilled from **Ponytail** (`ponytail-review`), **Superpowers** (two-stage review & `verification-before-completion`), **Trail of Bits** (`differential-review`, `insecure-defaults`, `sharp-edges`, `fp-check`, `supply-chain-risk-auditor`), **Betterleaks**, **OSV-Scanner**, and **Addy Osmani Web Quality Skills**.

## Active Roles Loaded by This Skill
- [`~/.kobean/roles/reviewer.yaml`](../../roles/reviewer.yaml) *(spec compliance, blast radius, bloat cut)*
- [`~/.kobean/roles/security.yaml`](../../roles/security.yaml) *(`betterleaks`, `semgrep`, OWASP, `fp-check`)*
- [`~/.kobean/roles/supply-chain.yaml`](../../roles/supply-chain.yaml) *(`osv-scanner`, dependency skepticism)*
- [`~/.kobean/roles/performance.yaml`](../../roles/performance.yaml) *(Core Web Vitals, query plans — when UI/API/DB changed)*
- [`~/.kobean/roles/a11y-auditor.yaml`](../../roles/a11y-auditor.yaml) *(WCAG 2.2 AA — when UI changed)*
- [`~/.kobean/roles/qa.yaml`](../../roles/qa.yaml) *(test suite execution & `spec.md` scenario verification)*

---

## Procedure

### 1. Gather the Diff & Blast Radius
1. Inspect the exact scope of changes:
   ```bash
   git status --short
   git diff HEAD
   ```
2. Check callers and dependents of modified symbols using `graphify` (`graphify-out/graph.json`) or `grep` so callers broken by signature/behavior changes are caught immediately.

### 2. Run Automated Security & Supply-Chain Scanners First
1. **Secrets Gate (`betterleaks`):**
   ```bash
   betterleaks dir . -v
   ```
2. **Supply-Chain Gate (if `package.json`, `pyproject.toml`, or lockfiles changed):**
   - Run `osv-scanner scan .` (or `npm audit --omit=dev` / `uv pip check`).
   - Flag any newly added package that could be replaced by < 20 lines of standard library code (Ponytail rule).
3. **Static Analysis & Trail of Bits Checklist:**
   - Check changed code against `references/checklists/owasp.md` (from `.kobean/` or `~/.kobean/`) for IDOR (missing tenant/user filter in SQL), fail-open defaults, unvalidated inputs, missing timeouts, and CI injection.
   - Apply the **False-Positive Gate (`fp-check`)**: verify a real source-to-sink path before reporting any `CRITICAL` or `HIGH` security issue.

### 3. Two-Stage Code Review (`reviewer` Role)
- **Stage 1 — Spec & Contract Compliance:** Does the implementation satisfy every scenario in `specs/NNN-<slug>/spec.md`, `plan.md`, and `threats.md` without drift?
- **Stage 2 — Code Quality & Ponytail Economy:**
  - Identify dead code, unnecessary wrappers, single-use abstractions, or over-engineering that can be deleted.
  - Verify error handling at trust boundaries and test coverage on new branches.

### 4. Conditional UI Audits (`a11y-auditor` & `performance`)
If frontend files (`src/web/**`, `src/components/**`, `app/**`) were touched:
- Verify against `references/checklists/wcag.md` and `references/checklists/perf-budgets.md` (from `.kobean/` or `~/.kobean/`, using `chrome-devtools-mcp`, `a11y-debugging`, and `debug-optimize-lcp` on Antigravity).

### 5. QA Verification Gate (`qa` Role — Mandatory Before Completion)
- Run the actual test commands (`vitest`, `playwright`, `pytest`) in the terminal **in this turn**. Never assume tests pass from earlier runs.
- Map each scenario in `spec.md` to its passing test.

## Output Format (Gate Report)

```markdown
## Review & Verification Gate: `PASS` | `BLOCK`

| Gate | Verdict | Summary |
| :--- | :--- | :--- |
| Spec Compliance (`reviewer`) | PASS/BLOCK | ... |
| Code Economy (`ponytail`) | PASS/WARN | ... |
| Secrets & AppSec (`security`) | PASS/BLOCK | `betterleaks`: 0 findings; ... |
| Supply Chain (`supply-chain`) | PASS/BLOCK | ... |
| A11y & Perf (`a11y`/`perf`) | PASS/N/A | ... |
| Test Suite (`qa`) | PASS/BLOCK | `<exact test command & result>` |

### Findings (Sorted by Severity: CRITICAL -> HIGH -> MEDIUM -> LOW)
1. **[SEVERITY] `path/to/file.ts:123`** — <problem> -> <minimal fix>
```

> **Hard Rule:** Any `CRITICAL` or `HIGH` finding, any `betterleaks` hit, or any failing test sets the overall verdict to **`BLOCK`**.

