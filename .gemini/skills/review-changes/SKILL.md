---
name: review-changes
description: Perform a structured, risk-aware code review using change detection and impact analysis. Trigger on /code-review, /review, or change audit requests.
---

# Code Review & Change Audit Workflow

Use this skill when auditing PRs, reviewing code modifications, or handling `/code-review` / `/review` requests.

## Review Steps

1. **Risk Scoring**:
   - Run `detect_changes_tool` to obtain risk-scored change metrics.
   - Categorize changes into High, Medium, and Low risk tiers.

2. **Flow & Coverage Audit**:
   - Run `get_affected_flows_tool` to trace modified execution paths.
   - Run `query_graph_tool` with `pattern="tests_for"` to verify test coverage for changed functions.

3. **Checklist**:
   - Secrets Handling: Are tokens or credentials leaked into SQLite or UI logs?
   - Design System: Are CSS design tokens (`var(...)`) used consistently?
   - Test Sync: Are `tests/*.test.mjs` contract assertions synchronized with source edits?
   - Git Safety: Confirm no `git push` or destructive commands were staged.

4. **Merge Recommendation**:
   - Provide summary grouped by risk level with actionable recommendations.
