---
name: kb-spec
description: >-
  Requirements specification, Socratic clarification, Ponytail Ultra existence
  check, and STRIDE threat modeling. Use before planning or coding any non-trivial
  feature to produce specs/NNN-<slug>/spec.md and (when auth, payments, PII, or
  secrets are involved) specs/NNN-<slug>/threats.md.
---

# `kb-spec` — Specification & Threat Modeling

Distilled from **GitHub Spec-Kit** (`specify`, `clarify`, `constitution`), **Superpowers** (`brainstorming`), **Ponytail** (`ultra` existence check), **OpenSpec** (brownfield deltas), and **STRIDE-GPT / Trail of Bits** (`threat-modeler`).

## Active Roles Loaded by This Skill
- [`~/.kobean/roles/explorer.yaml`](../../roles/explorer.yaml) *(if `CONTEXT.md` is missing on an existing repo)*
- [`~/.kobean/roles/po.yaml`](../../roles/po.yaml) *(primary)*
- [`~/.kobean/roles/threat-modeler.yaml`](../../roles/threat-modeler.yaml) *(triggered when feature touches Auth, Payments, PII, External APIs, or Secrets)*

---

## Procedure

### 1. Codebase Orientation & Constitution Check
1. If the repository is non-trivial and neither `CONTEXT.md` nor `graphify-out/GRAPH_REPORT.md` exists:
   - Run `graphify` (if needed) or dispatch the `explorer` role (`invoke_subagent(TypeName="research", Role="Codebase Cartographer", ...)`) to produce `CONTEXT.md`.
2. Check for `.kobean/constitution.md`. If missing on a project where you will build multiple features, initialize it from `.kobean/templates/constitution.md` (or `~/.kobean/templates/constitution.md`).

### 2. Ponytail Ultra Gate ("Should This Exist?")
Before drafting a spec, answer these three questions in 3 concise bullets:
1. **What breaks or hurts if we don't build this?**
2. **Does the codebase, platform, or an installed library already solve 80% of this?**
3. **What part of the request is speculative bloat that we should cut right now?**

If the entire request can be solved by a 3-line config or existing feature, tell the user and stop before writing a spec.

### 3. Socratic Clarification (`brainstorming` + `clarify`)
- Do **not** guess on ambiguous scope, permissions, data retention, or error states.
- Ask at most **1 to 4 high-impact questions** at a time using `ask_question` (on Antigravity) with concrete options and a `(Recommended)` default first.

### 4. Write `specs/NNN-<slug>/spec.md`
Use `.kobean/templates/spec.md` (or `~/.kobean/templates/spec.md`):
- Number features sequentially (`specs/001-user-auth/spec.md`).
- Write **Given / When / Then** acceptance scenarios prioritized (`P1`, `P2`).
- For changes to an existing codebase, fill out the **Delta Summary** (`ADDED`, `MODIFIED`, `REMOVED`).
- Explicitly mark the **Security / Trust Boundary** trigger (`Yes` or `No`).

### 5. Conditional Threat Model (`specs/NNN-<slug>/threats.md`)
If the feature touches authentication, authorization, billing/payments, PII, file uploads, webhooks, or external credentials:
1. Load `roles/threat-modeler.yaml` and `references/checklists/owasp.md` (from `.kobean/` or `~/.kobean/`).
2. Generate `specs/NNN-<slug>/threats.md` from `templates/threats.md` covering STRIDE, DREAD scores, fail-closed defaults, and IDOR checks.

## Verification & Handoff
- Confirm `specs/NNN-<slug>/spec.md` has zero `TODO` or `[NEEDS CLARIFICATION]` placeholders.
- Ask the user to approve the spec (or proceed directly to [`kb-plan`](../kb-plan/SKILL.md) if the user asked for an end-to-end build).

