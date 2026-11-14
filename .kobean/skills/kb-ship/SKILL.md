---
name: kb-ship
description: >-
  Release readiness, Diataxis technical documentation, ADR authoring, CI/CD
  hardening, changelog generation, and rollback planning. Use when preparing to
  merge, release, document, or deploy completed work.
---

# `kb-ship` — Documentation, CI/CD & Release Management

Distilled from **Addy Osmani** (`shipping-and-launch`, `git-workflow-and-versioning`, `documentation-and-adrs`, `ci-cd-and-automation`), **Anthropic Skills** (`doc-coauthoring`), **Diátaxis**, **Trail of Bits** (`agentic-actions-auditor`), and **Superpowers** (`finishing-a-development-branch`).

## Active Roles Loaded by This Skill
- [`~/.kobean/roles/tech-writer.yaml`](../../roles/tech-writer.yaml) *(README, Diátaxis docs, ADRs)*
- [`~/.kobean/roles/devops.yaml`](../../roles/devops.yaml) *(CI/CD, Docker, deployment safety)*
- [`~/.kobean/roles/release-manager.yaml`](../../roles/release-manager.yaml) *(pre-release gates, SemVer, `CHANGELOG.md`, rollback note)*

---

## Procedure

### 1. Pre-Ship Verification Gate
Before cutting docs or a release, verify:
1. **Beads Queue Clean:** If `.beads/` exists, run `bd ready --json` and `bd list --json` to confirm no P1 blocker issues remain open for the current feature/milestone.
2. **Security & Tests Green:** Confirm [`kb-review`](../kb-review/SKILL.md) passed (`betterleaks dir . -v` = 0 findings, test suites green).
3. Read `references/checklists/release.md` (from `.kobean/` or `~/.kobean/`).

### 2. Documentation & ADRs (`tech-writer` Role)
1. Read `roles/tech-writer.yaml` and `references/checklists/release.md` (Section 3: Diátaxis).
2. Update only the documentation sections affected by the change:
   - Keep **Tutorials**, **How-To Guides**, **Reference tables** (CLI flags, env vars, endpoints), and **Explanation/ADRs** cleanly separated.
3. **Reader-Test Loop (`doc-coauthoring`):** Verify that every command, file path, and environment variable named in `README.md` or `docs/` actually exists in the repository.

### 3. CI/CD & Deployment Hardening (`devops` Role — If Applicable)
If `.github/workflows/**`, `Dockerfile*`, or `infra/**` are part of the ship scope:
1. Read `roles/devops.yaml` (from `.kobean/` or `~/.kobean/`).
2. Audit workflows for Trail of Bits `agentic-actions-auditor` rules: pin third-party actions to commit SHAs, use minimal `permissions:`, and never interpolate `${{ github.event.* }}` untrusted inputs directly inside `run:` shell scripts.

### 4. Changelog, Version Bump & Rollback Plan (`release-manager` Role)
1. Inspect commits since the last tag (`git log <last-tag>..HEAD --oneline` or `git log -n 20 --oneline`).
2. Determine the Semantic Version bump (`MAJOR`, `MINOR`, `PATCH`) from Conventional Commits.
3. Update `CHANGELOG.md` under **Added / Changed / Fixed / Security / Breaking Changes**.
4. Document the **Rollback Plan** in the release summary:
   - Exact git revert/tag target.
   - Whether any database migrations in `migrations/` are reversible or expand-only.

## Safety Rule
Never run `git push --force`, publish to a public registry (`npm publish`), or deploy to production without explicit user confirmation in the chat turn.

