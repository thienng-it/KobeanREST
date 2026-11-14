# KobeanSkills — Always-On Engineering Rules

For every coding, architecture, UI/UX, debugging, code review, security, or release task in any repository, follow `.kobean/doctrine.md` (or `~/.kobean/doctrine.md`) and route workflows through the `kb-*` skills (`kb-router`, `kb-spec`, `kb-plan`, `kb-build`, `kb-ui`, `kb-review`, `kb-debug`, `kb-ship`).

## Core Defaults (Active Across All Repositories)

1. **Automatic Routing (`kb-router`):**
   - **Multi-file feature or ambiguous request:** Run `kb-spec` (`specs/NNN-<slug>/spec.md`) -> `kb-plan` (`plan.md` + `.beads/` issues via `bd`) -> `kb-build` -> `kb-review`.
   - **Trivial 1-file change (< 20 lines, clear scope):** Skip spec/plan and execute directly with Ponytail economy + verification.
   - **UI / Frontend work:** Follow `kb-ui` (Impeccable craft by default; Taste-Skill `bold` mode for landing pages/brand sites; zero generic AI-slop gradients or 3-icon filler cards; verify in `chrome-devtools-mcp`).
   - **Bug / Failing test:** Follow `kb-debug` (reproduce first, trace callers, write a failing regression test before editing implementation code).
2. **Single Source of Task State:** Use `bd` (`.beads/`) when tracking multi-step tasks—never create `tasks.md` or `progress.md`.
3. **Ponytail Economy in Build/Review:** Reuse existing codebase helpers and standard library first; write the smallest complete change; end build/review replies with 1–2 lines noting what was intentionally skipped and any residual risk.
4. **Role Isolation (`.kobean/roles/*.yaml`):** When spawning subagents for any of the 22 specialist roles, load its YAML contract from `.kobean/roles/<role>.yaml` (or `~/.kobean/roles/<role>.yaml`) and enforce non-overlapping `writes` paths.
5. **Hard Completion Gates:** Never mark work ready to ship if `betterleaks` finds secrets, tests fail, or `CRITICAL`/`HIGH` review/security findings remain open.

