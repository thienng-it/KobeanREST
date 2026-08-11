---
name: code-review
description: Perform a comprehensive, risk-scored code review of recent changes using the code-review-graph MCP. Trigger when the user types /code-review or /review.
---

# Code Review Skill (`/code-review`, `/review`)

Use this skill when the user types `/code-review` or `/review` to conduct a principal-level, risk-scored audit of recent codebase modifications.

## Execution Workflow

1. **Risk Scoring & Change Analysis**:
   - Run `detect_changes_tool` to obtain risk-scored change metrics.
   - Categorize modified files into High, Medium, and Low risk tiers.

2. **Impact Radius & Flow Mapping**:
   - Run `get_impact_radius_tool` on modified modules to evaluate potential blast radius.
   - Run `get_affected_flows_tool` to identify impacted execution paths.

3. **Test Coverage & Contract Verification**:
   - For modified components or functions, run `query_graph_tool` with `pattern="tests_for"` to check test coverage.
   - Verify if any contract tests in `tests/*.test.mjs` need regex synchronization.

4. **Security & Architectural Audit**:
   - **Secrets Safety**: Confirm passwords, OAuth tokens, and secret headers are stored via OS Keychain (`persistence.rs`) and not in plaintext SQLite fields or UI state.
   - **UI Styling**: Confirm custom CSS variables (`var(...)`) are used instead of inline hex colors or unapproved tailwind hacks.
   - **Component Decoupling**: Ensure `LayoutControls` remains decoupled from `TabBar`.
   - **Git Safety**: Verify no destructive commands (`git push`, `git reset --hard`) were staged.

5. **Structured Markdown Report**:
   - Output concise findings grouped by Risk Level (High/Medium/Low) with actionable recommendations and merge readiness score.

## Token Budget & Constraints
- Maximum 5 tool calls.
- Output high-signal Markdown report without conversational filler.
