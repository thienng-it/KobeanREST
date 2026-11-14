---
name: kb-git
description: >-
  Git branch lifecycle (create, rename, delete), conventional commits, rebase
  on master/main, clean push, and GitHub PR workflows with elegant PR
  templates. Use for branching, committing, rebasing, opening or editing pull
  requests.
---

# `kb-git` — Git & Pull Request Engineering Workflows

Distilled from **Addy Osmani** (`git-workflow-and-versioning`), **Superpowers** (`finishing-a-development-branch`), **Trail of Bits** (`agentic-actions-auditor`), and **Conventional Commits**.

## Active Roles Loaded by This Skill
- [`~/.kobean/roles/release-manager.yaml`](../../roles/release-manager.yaml) *(Git lifecycle, SemVer, commit hygiene, PR coordination)*
- [`~/.kobean/roles/devops.yaml`](../../roles/devops.yaml) *(CI check verification, remote push safety)*

---

## Core Capabilities & Procedures

### 1. Branch Lifecycle Management
* **Create Feature Branch:**
  ```bash
  git fetch origin
  git checkout -b <type>/<slug> origin/main # or origin/master
  ```
  *Allowed prefixes:* `feat/`, `fix/`, `refactor/`, `perf/`, `docs/`, `chore/`.
* **Rename Current Branch:**
  ```bash
  git branch -m <type>/<new-slug>
  ```
* **Safe Local Delete:**
  ```bash
  git branch -d <branch-name>
  ```
* **Remote Branch Delete:**
  ```bash
  git push origin --delete <branch-name>
  ```
* **Safety Invariant:** Never delete, force-push to, or rename protected default branches (`main`, `master`).

---

### 2. Atomic Conventional Commits
Before every commit, run quality checks:
1. **Secret Check Gate:** Confirm `betterleaks dir . -v` finds 0 leaks.
2. **Inspect Diff:** Check `git status` and `git diff` to ensure only intended files are staged (avoid blanket `git add -A`).
3. **Commit Structure:**
   ```text
   <type>(<scope>): <concise imperative summary>

   [optional details explaining motivation and architectural decisions]

   [optional reference to issue or Beads task: Closes #123]
   ```

---

### 3. Rebase on Default Branch (`main` / `master`)
Maintain linear history and eliminate unnecessary merge commits:
```bash
git fetch origin
git rebase origin/main # or origin/master
```
* **Conflict Resolution Protocol:**
  1. Inspect conflicted files with `git status`.
  2. Open conflicted files, resolve markers (`<<<<<<<`, `=======`, `>>>>>>>`), and run tests to verify correctness.
  3. Stage resolved files: `git add <file>`.
  4. Continue rebase: `git rebase --continue`.
  5. If needed, cleanly abort with `git rebase --abort`.

---

### 4. Safe Remote Push
* **Initial Upstream Push:**
  ```bash
  git push -u origin <branch-name>
  ```
* **Rebased Feature Branch Update:**
  ```bash
  git push --force-with-lease origin <branch-name>
  ```
* **Iron Law:** Never run raw `--force`. Only use `--force-with-lease` on private feature branches.

---

### 5. Pull Requests with Elegant Templates
1. Verify template exists: Check `.github/pull_request_template.md` or `.kobean/templates/PULL_REQUEST_TEMPLATE.md`.
2. Open PR via GitHub CLI:
   ```bash
   gh pr create --title "<type>(<scope>): <summary>" --body-file .github/pull_request_template.md
   ```
3. Edit existing PR:
   ```bash
   gh pr edit [pr-number] --title "..." --body "..."
   ```
4. Verify PR CI status:
   ```bash
   gh pr checks
   ```

