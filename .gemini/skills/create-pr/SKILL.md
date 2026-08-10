---
name: create-pr
description: Automate creating a pull request to main branch with clean checks, formatted description, and Conventional Commits title. Trigger on /create-pr, /pr, or /pull-request.
---

# Pull Request Creation Workflow (`/create-pr`, `/pr`)

Use this skill when the user types `/create-pr`, `/pr`, or `/pull-request` to safely format, verify, and submit a Pull Request to GitHub.

## Protocol

### 1. Pre-Submission Checks
- **Working Tree Verification**: Run `git status` to ensure working tree is committed or stashed cleanly.
- **Verification Suite**: Run `npm test` and `npm --prefix vscode-extension run lint 2>&1 | grep -A5 -E "error TS"`.

### 2. Branch & Commits
- If currently on `main` branch, create a feature branch (`git checkout -b feat/...`) before creating the PR.
- Ensure all commits follow Conventional Commits formatting (`feat(...)`, `fix(...)`, `refactor(...)`).

### 3. PR Description Template
Generate PR description with:
- **Summary**: Concise overview of changes.
- **Components Impacted**: List of modified modules (e.g. `src-tauri/`, `src/renderer/`, `vscode-extension/`).
- **Test Evidence**: Results of automated test runs.
- **Security Check**: Confirmation that OS Keychain secret isolation and safety rules were met.

### 4. Dispatch PR
- Execute `gh pr create --title "<type>(<scope>): <summary>" --body "<description>"` or output payload for user approval.

## Token Budget & Constraints
- Maximum 5 tool calls.
- High signal-to-noise Markdown output without conversational filler.
