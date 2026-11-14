# KobeanSkills — Developer Workflow Guide & Cheatsheet

This guide explains how to effectively use KobeanSkills across all daily engineering workflows.

---

## 1. Two Ways to Trigger Workflows

You never need to memorize complex syntax. You can trigger workflows in two ways:

1. **Natural Language (Intent-Based):** Just describe what you want naturally. The global rules in `AGENTS.md` automatically route the task to the right pipeline.
2. **Explicit Skill Invocations (Command-Style):** Mention the entry skill (e.g., `kb-spec`, `kb-ui`, `kb-review`) directly for explicit control.

---

## 2. The 6 Core Engineering Playbooks

### Playbook 1: Building a Feature End-to-End

When building a new capability, endpoint, or multi-file enhancement:

```text
Prompt:
"Use kb-router to build an invitation system where admins can invite teammates via email with expiring tokens."
```

**What the AI pipeline does step-by-step:**
1. **Spec Phase (`kb-spec`):** 
   - Checks if existing code/libraries already do this (Ponytail Ultra gate).
   - Asks you 1–3 clarifying questions via `ask_question` about edge cases (e.g., token expiration, duplicate invites).
   - Generates `specs/001-invites/spec.md` (and `threats.md` if touching auth/tokens).
2. **Architecture & Contracts Phase (`kb-plan`):**
   - Designs shared Zod/OpenAPI schemas in `contracts/`.
   - Defines database tables and indexes in `data-model.md`.
   - Generates dependency-ordered tasks in `.beads/` using `bd`.
3. **Execution Phase (`kb-build`):**
   - Fetches unblocked tasks (`bd ready`).
   - Writes automated tests *first* (Red phase), writes minimal code to pass (Green phase), and refactors.
   - Closes each task in `.beads/` automatically.
4. **Verification Phase (`kb-review`):**
   - Scans for hardcoded secrets (`betterleaks`).
   - Audits against Trail of Bits security rules and runs test suites.
5. **Ship Phase (`kb-ship`):**
   - Updates documentation and logs user-facing changes in `CHANGELOG.md`.

---

### Playbook 2: High-Craft UI/UX Design

When building frontend surfaces, landing pages, or product interfaces:

```text
# Standard Product UI (Dashboards, forms, settings, data tables):
"Use kb-ui to build the user analytics dashboard."

# Bold / High-Agency Art Direction (Landing pages, marketing, brand sites):
"Use kb-ui in bold mode to design the marketing homepage."
```

**Key rules the AI enforces:**
- **Zero AI-Slop:** Banned from using generic purple/blue neon gradients, 3-card marketing clichés, or filler text ("Supercharge your workflow").
- **Design Tokens First:** Creates or references `PRODUCT.md` for typographic scales, semantic color tokens, and spacing grids.
- **Complete States:** Generates all 4 required states: **Loading Skeleton** (zero layout shift, `CLS <= 0.1`), **Empty State**, **Error with Retry**, and **Populated**.
- **Live Verification:** Connects to your local dev server via `chrome-devtools-mcp` to verify mobile responsiveness (`390px`, `768px`, `1024px`, `1440px`) and accessibility (`WCAG 2.2 AA`).

---

### Playbook 3: Systematic Bug Fixing & Diagnostics

When fixing regressions, failing tests, or runtime exceptions:

```text
Prompt:
"Use kb-debug to investigate this error:
[Paste error log, stack trace, or failing test output]"
```

**What the AI does:**
- **Iron Law:** The agent is forbidden from applying random patches or guessing.
- **Reproduces First:** Runs the failing command or writes a reproduction script.
- **Traces Callers:** Uses `graphify` to inspect every caller of the broken function.
- **Regression Test First:** Adds a test that reproduces the bug (Red phase).
- **Minimal Fix:** Applies the smallest root-cause fix in shared code and proves both the new regression test and all existing test suites pass.

---

### Playbook 4: Code Review, Security & Pre-PR Gate

Before opening a pull request or merging a feature branch:

```text
Prompt:
"Use kb-review to audit my current git changes."
```

**Output provided:**
- **Secrets Gate:** Automated `betterleaks` scan output (0 leaks allowed).
- **Trail of Bits AppSec Audit:** Checks for IDOR, insecure defaults, timing attacks, and unvalidated inputs.
- **Code Economy Review:** Flags unnecessary wrappers, dead code, or bloat that can be deleted before shipping.
- **QA Verification:** Proves that all unit, integration, and E2E tests pass cleanly in the current turn.

---

### Playbook 5: Technical Debt & Simplification

When a codebase feels bloated or over-engineered:

```text
Prompt:
"Use kb-build with the refactorer role to clean up and simplify src/server/auth."
```

**What the AI does:**
- Runs the test suite before touching anything to establish a green baseline.
- Deletes dead code, collapses single-use abstractions, and simplifies control flow.
- Documents any remaining shortcuts or limits in `DEBT.md`.
- Proves zero change in functional behavior by re-running the test suite.

---

### Playbook 6: Unfamiliar Codebase Onboarding

When working on a new repository for the first time:

```text
Prompt:
"Use kb-router to onboard this repository."
```

**What the AI does:**
- Runs `graphify` (AST parser) to map modules, entry points, and dependency trees.
- Produces `CONTEXT.md` summarizing core directories, architectural patterns, shared helpers to reuse, and how to run tests.

---

### Playbook 7: Bootstrapping a Project From Zero (Greenfield Scaffolding)

When creating a brand-new repository from scratch:

```text
Step 1 (In terminal):
mkdir my-app && cd my-app && git init
npx kobean-skills init   # or bunx kobean-skills init

Step 2 (In chat prompt):
"Bootstrap a new production-ready SaaS application with Next.js App Router, PostgreSQL, and Drizzle ORM. Start with kb-spec to define the project constitution and architecture."
```

**What the AI pipeline does step-by-step:**
1. **Foundation (`kb-spec`):**
   - Populates `constitution.md`: Tech stack choices, architectural invariants, and explicit non-goals (what will never be built).
   - Generates `PRODUCT.md`: Brand voice, aesthetic tone, typography scale, and color tokens.
   - Generates `specs/001-bootstrap/spec.md`: Baseline MVP requirements and user journeys.
   - Generates `specs/001-bootstrap/threats.md`: STRIDE threat model for authentication, authorization, and data isolation.
2. **Architecture & Schema (`kb-plan`):**
   - Blueprints directory structure using vetted references in `.kobean/references/stacks/`.
   - Generates `specs/001-bootstrap/data-model.md` with normalized schema, constraints, and indexes.
   - Generates API contracts in `contracts/`.
   - Populates `.beads/` with the dependency-ordered task graph via `bd`.
3. **Scaffolding & Implementation (`kb-build`):**
   - `devops`: Initializes package manager, TypeScript configuration, linter, formatter, and GitHub Actions CI.
   - `data-engineer`: Scaffolds database connection, migrations, and seed scripts.
   - `backend` & `frontend`: Builds out baseline routes and UI shells enforcing TDD (Red-Green-Refactor).
4. **Initial Release (`kb-review` & `kb-ship`):**
   - Runs `betterleaks` to ensure zero secrets in initial commits.
   - Authorizes ADR-0001 (Architecture Decision Record) and tags initial release `v0.1.0`.

---

### Playbook 8: Managing Connectors & MCP Servers (Zero-Drift)

When you need your AI agents to query your database, interact with GitHub, inspect logs, or automate browsers:

```bash
# 1. Browse 38+ connectors in the Marketplace directory:
bunx kobean-skills mcp marketplace

# 2. Search for any connector by keyword (e.g. database, linear, supabase):
bunx kobean-skills mcp search database

# 3. Add connectors in one command (automatically wires Claude, Gemini, Antigravity, and Codex):
bunx kobean-skills mcp add postgres      # PostgreSQL database queries & schema
bunx kobean-skills mcp add supabase      # Supabase tables, auth & storage
bunx kobean-skills mcp add github        # Pull requests, issues, repo management
bunx kobean-skills mcp add playwright    # Headless browser testing & UI automation
bunx kobean-skills mcp add docker        # Docker container & compose manager
bunx kobean-skills mcp add sentry        # Sentry error logs & stack traces

# 4. Check connector status and environment audit:
bunx kobean-skills mcp list

# 5. Re-sync all agent config files after manual edits to .kobean/mcp.json:
bunx kobean-skills mcp sync
```

**How Kobean keeps credentials safe:**
- Kobean stores `${DATABASE_URL}` or `${GITHUB_TOKEN}` references in `.kobean/mcp.json` instead of plaintext passwords.
- The sync engine exports `.mcp.json` (Claude), `.agents/mcp.json` & `.gemini/mcp_config.json` (Antigravity/Gemini), and `.codex/config.toml` (Codex) while preserving variable placeholders.
- Kobean's `doctor` command automatically verifies whether your `.env` has all required keys filled.

---

### Playbook 9: Git, Branching & Pull Request Workflows

When creating branches, committing changes, rebasing on master/main, or opening pull requests:

```text
Prompt:
"Use kb-git to create branch feat/webhook-retry, commit with conventional format, rebase on main, and open a PR with the template."
```

**What the AI does step-by-step:**
1. **Branch Lifecycle:** Checks out a clean feature branch (`feat/<slug>`, `fix/<slug>`, or `chore/<slug>`) from latest `origin/main` (or `master`).
2. **Atomic Conventional Commits:** Runs `betterleaks` secret gate, stages specific files, and commits with `type(scope): summary`.
3. **Linear Rebase:** Fetches latest remote and rebases on `origin/main` (or `master`), cleanly resolving conflict markers if any arise.
4. **Lease-Protected Push:** Pushes upstream (`git push -u origin <branch>`), using `--force-with-lease` on private feature branches. Never force-pushes to master/main.
5. **Clean Pull Request:** Uses `.github/pull_request_template.md` to craft a simple, elegant PR and opens it via `gh pr create`.

---

## 3. Power Controls & Steering

| If you want to... | What to say |
| :--- | :--- |
| **Question whether a feature is necessary** | `"Run kb-spec with ponytail ultra"` |
| **Keep implementations ultra-minimal** | `"Use ponytail mode: smallest possible diff"` |
| **Manage branches, rebase & open PRs** | `"Use kb-git to rebase on main and create PR"` |
| **Scaffold clean PR template** | Run `bunx kobean-skills pr-template` |
| **Inspect skills or read runbook** | Run `bunx kobean-skills skills` or `skill <name>` |
| **Inspect roles or view contract YAML** | Run `bunx kobean-skills roles` or `role <name>` |
| **Browse or extract playbooks** | Run `bunx kobean-skills playbooks` or `playbook <name>` |
| **Get command-specific help manual** | Run `bunx kobean-skills help [command]` |
| **Inspect task status** | Run `bd ready` or `bd list` in terminal |
| **Manage MCP connectors across agents** | Run `bunx kobean-skills mcp` |
| **Check installed tools & MCP status** | Run `bunx kobean-skills doctor` |
| **Clean up global links** | Run `bunx kobean-skills install --uninstall` |

---

## 4. Where Artifacts Live in Your Project

| File / Folder | Purpose |
| :--- | :--- |
| `.kobean/` | Engine folder containing skills, 22 role contracts, stack guides, and doctrine. |
| `.kobean/mcp.json` | Single source of truth for Model Context Protocol (MCP) server connectors. |
| `.mcp.json` | Claude Code MCP configuration (auto-synced from `.kobean/mcp.json`). |
| `.agents/mcp.json` | Antigravity MCP configuration (auto-synced from `.kobean/mcp.json`). |
| `.gemini/mcp_config.json` | Gemini CLI MCP configuration (auto-synced from `.kobean/mcp.json`). |
| `.codex/config.toml` | Codex CLI MCP configuration in TOML (auto-synced from `.kobean/mcp.json`). |
| `.kobean/constitution.md` | Your project's explicit rules and non-goals. |
| `specs/NNN-<slug>/spec.md` | Requirements specifications with Given/When/Then acceptance tests. |
| `specs/NNN-<slug>/plan.md` | Technical plans and file-level write assignments. |
| `specs/NNN-<slug>/threats.md`| STRIDE threat models and DREAD security scoring. |
| `.beads/` | Version-controlled task dependency graph (managed by `bd`). |
| `PRODUCT.md` | Design system, brand voice, typography scale, and color tokens. |
| `CONTEXT.md` | High-level codebase architecture map generated by `graphify`. |

