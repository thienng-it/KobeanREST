---
name: kb-router
description: >-
  Primary orchestrator for the KobeanSkills engineering system. Use when starting
  a new task, feature, UI build, bugfix, refactor, code review, security audit,
  or release to classify the request, select the right pipeline, and dispatch
  specialist role contracts from .kobean/roles/ (or ~/.kobean/roles/).
---

# `kb-router` — Kobean Engineering Orchestrator

You are the entry-point orchestrator for **KobeanSkills**. Instead of jumping straight into writing code, classify the user's request, load `.kobean/doctrine.md` (or `~/.kobean/doctrine.md`), and run the matching pipeline below.

## Step 1: Read Doctrine & Project Context

1. Read `.kobean/doctrine.md` (or `~/.kobean/doctrine.md` if not in project root) for authority hierarchy, Ponytail rules, UI bans, and completion gates.
2. Check the current workspace for:
   - `.kobean/constitution.md` (project rules)
   - `CONTEXT.md` or `graphify-out/GRAPH_REPORT.md` (codebase map)
   - `.beads/` (`bd ready --json` for active tasks)
   - `PRODUCT.md` (design system, if UI work is involved)

## Step 2: Classify Request & Select Pipeline

| Request Type | Trigger Signals | Pipeline to Execute |
| :--- | :--- | :--- |
| **`help`** | "How do I use this?", "What skills are available?", "Show me the guide", "help" | Display the workflow playbooks from `GUIDE.md` |
| **`onboard`** | Unfamiliar repo, "map this codebase", or no `CONTEXT.md` / `graphify-out/` on a large project | `explorer` -> write `CONTEXT.md` |
| **`feature`** | New capability, multi-file change, or ambiguous requirements | [`kb-spec`](../kb-spec/SKILL.md) -> [`kb-plan`](../kb-plan/SKILL.md) -> [`kb-build`](../kb-build/SKILL.md) -> [`kb-review`](../kb-review/SKILL.md) -> [`kb-ship`](../kb-ship/SKILL.md) |
| **`ui`** | Landing page, redesign, component craft, design system, "make it bolder/cleaner" | [`kb-spec`](../kb-spec/SKILL.md) *(lite)* -> [`kb-ui`](../kb-ui/SKILL.md) -> [`kb-review`](../kb-review/SKILL.md) |
| **`bugfix`** | Failing test, error log, regression, broken behavior | [`kb-debug`](../kb-debug/SKILL.md) -> [`kb-review`](../kb-review/SKILL.md) |
| **`refactor`** | "Clean up", "simplify", "pay down debt", "ponytail audit" | `explorer` *(if needed)* -> [`kb-build`](../kb-build/SKILL.md) (`refactorer` role) -> [`kb-review`](../kb-review/SKILL.md) |
| **`review`** | "Review PR/diff", "audit security", "check performance/a11y" | [`kb-review`](../kb-review/SKILL.md) |
| **`git`** | "commit", "push", "branch", "create/delete branch", "rebase master/main", "PR" | [`kb-git`](../kb-git/SKILL.md) -> Conventional Commits, rebase & PR template |
| **`ship`** | "Prepare release", "update changelog/docs", "deploy/CI" | [`kb-ship`](../kb-ship/SKILL.md) |

> **Fast-Path Rule (Ponytail Economy):** If the user asks for a trivial, unambiguous 1-file fix (< 20 lines, no schema/auth change), skip `kb-spec` and `kb-plan` and go directly to `kb-build` or `kb-debug`.

## Step 3: How to Dispatch Any Specialist Role

Whenever a pipeline step invokes one of the 22 roles:

1. Read `.kobean/roles/<role>.yaml` (or `~/.kobean/roles/<role>.yaml`) and any files listed in its `references:` field (under `.kobean/references/` or `~/.kobean/references/`).
2. **If running in parallel or isolating context:**
   - **On Antigravity:** Call `invoke_subagent`:
     - Use `TypeName: "research"` when `subagent_type: research` (read-only roles: `explorer`, `reviewer`, `security`, `supply-chain`, `performance`, `a11y-auditor`).
     - Use `TypeName: "self"` when `subagent_type: self` (write-enabled roles).
     - Set `Role` to the `title` from `<role>.yaml`.
     - In `Prompt`, include: (a) the role's `mission`, `writes`, `forbidden`, and `done_when` rules, (b) the target `specs/NNN-<slug>/` or Bead ID, and (c) the required `output` format.
   - **On Claude Code:** Use the `Agent` / `Task` tool with the same prompt payload.
   - **On Codex CLI:** Dispatch role subagents or load `.kobean/roles/<role>.yaml` as the binding role contract for the turn.
3. **If running sequentially in the current turn** (for small tasks): adopt the role contract directly and strictly obey its `writes`, `forbidden`, and `done_when` rules.

## Verification

Before ending the turn, state in 1 line which pipeline and active role(s) are executing, and confirm that all required gates in `~/.kobean/doctrine.md` are scheduled.

