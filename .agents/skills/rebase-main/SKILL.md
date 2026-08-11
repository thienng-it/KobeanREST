---
name: rebase-main
description: Pull latest remote code from main/master branch and safely rebase active branch with conflict handling. Trigger on /rebase, /rebase-main, /sync, or /pull-latest.
---

# Rebase Branch & Pull Latest Code Workflow (`/rebase`, `/rebase-main`)

Use this skill when the user types `/rebase`, `/rebase-main`, `/sync`, or `/pull-latest` to fetch remote updates and safely rebase the working branch against `main` (or `master`).

## Protocol

### 1. Working Tree Pre-Checks
- Check `git status` for unstaged or uncommitted changes.
- If uncommitted changes exist, perform `git stash push -m "WIP before rebase"` before proceeding.

### 2. Fetch Remote Updates
- Run `git fetch origin` to fetch all remote branch heads.
- Detect target default branch (`main` vs `master`):
  - Check `git rev-parse --verify origin/main` or `git rev-parse --verify origin/master`.

### 3. Rebase Protocol
- Execute `git rebase origin/main` (or `git rebase origin/master`).
- **If Merge Conflict Occurs**:
  1. Inspect conflicted files using `git status`.
  2. Inspect diff markers (`<<<<<<< HEAD` / `>>>>>>>`).
  3. Resolve conflict cleanly preserving source contracts.
  4. Stage resolved files (`git add <file>`) and continue: `git rebase --continue`.

### 4. Post-Rebase Verification
- Restore stashed changes if any were stashed (`git stash pop`).
- Re-run test suite (`npm test 2>&1 | grep -A5 -E "FAIL|ERROR"`).
- Output concise rebase completion summary.

## Token Budget & Constraints
- Maximum 5 tool calls.
- High signal-to-noise Markdown output without conversational filler.
