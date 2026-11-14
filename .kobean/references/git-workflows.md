# Git & Pull Request Engineering Workflows

Clean, minimal, and reproducible Git operations for solo developers and high-velocity engineering teams.

---

## 1. Branch Naming Conventions

Always branch from the latest state of your default branch (`main` or `master`).

| Prefix | Use Case | Example |
| :--- | :--- | :--- |
| `feat/` | New feature or user-facing capability | `feat/webhook-retry` |
| `fix/` | Bug fix or regression resolution | `fix/auth-token-leak` |
| `refactor/` | Code restructuring with zero behavior changes | `refactor/db-connection-pool` |
| `perf/` | Performance improvement or optimization | `perf/lcp-image-preload` |
| `docs/` | Documentation, guides, or ADR additions | `docs/mcp-directory-guide` |
| `chore/` | Tooling, dependencies, or configuration updates | `chore/upgrade-bun` |

---

## 2. Branch Lifecycle Commands

```bash
# Create and switch to a new feature branch
git checkout -b feat/my-feature

# Rename current local branch
git branch -m feat/my-new-name

# Rename a different branch
git branch -m <old-name> <new-name>

# Delete a merged local branch safely
git branch -d feat/my-feature

# Force delete an unmerged local branch (requires caution)
git branch -D feat/abandoned-feature

# Delete a remote branch
git push origin --delete feat/my-feature
```

---

## 3. Conventional Commit Protocol

Keep commits atomic, scoped, and meaningful.

```text
<type>(<scope>): <short summary in imperative mood>

[optional body explaining motivation and architectural context]

[optional footer referencing issue or Beads task]
```

### Commit Types
* `feat`: New user-facing feature
* `fix`: Bug fix
* `refactor`: Code change that neither fixes a bug nor adds a feature
* `perf`: Code change that improves performance
* `test`: Adding missing tests or correcting existing tests
* `docs`: Documentation changes only
* `chore`: Build process, package updates, or auxiliary tool changes

### Commit Quality Gate
1. Inspect diff before staging: `git diff`
2. Scan for hardcoded credentials: `betterleaks dir . -v`
3. Stage specific files (avoid blanket `git add -A`): `git add <files>`
4. Commit with descriptive message: `git commit -m "feat(auth): add expiring token verification"`

---

## 4. Rebase Default Branch (`main` / `master`)

Keep your branch history linear, clean, and conflict-free without dirty merge commits.

```bash
# 1. Fetch latest changes from remote
git fetch origin

# 2. Rebase your feature branch on top of origin/main (or origin/master)
git rebase origin/main
```

### Clean Conflict Resolution Protocol
When a conflict occurs during rebase:
1. Inspect conflicted files: `git status`
2. Open conflicted files and resolve `<<<<<<<`, `=======`, `>>>>>>>` markers.
3. Verify tests and syntax after resolution.
4. Stage the resolved files: `git add <resolved-file>`
5. Continue the rebase: `git rebase --continue`
6. If things go wrong, cleanly abort anytime to restore original state: `git rebase --abort`

---

## 5. Safe Push Protocol

```bash
# Initial push with upstream tracking
git push -u origin feat/my-feature

# Updating a rebased feature branch (NEVER use raw --force!)
git push --force-with-lease origin feat/my-feature
```

> **Safety Rule:** Never force push to `main` or `master`. Always use `--force-with-lease` on feature branches to prevent overwriting teammates' work.

---

## 6. GitHub Pull Request (PR) Workflow via CLI

```bash
# Check current branch and diff
git status
git diff origin/main..HEAD --stat

# Create PR using the repository template
gh pr create --title "feat(scope): concise summary" --body-file .github/pull_request_template.md

# Create PR with interactive prompt
gh pr create --web

# View PR details and review status
gh pr view

# Edit an existing PR title or body
gh pr edit --title "feat(scope): updated summary"

# Check CI workflow checks
gh pr checks
```

