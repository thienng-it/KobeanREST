---
name: debug-issue
description: Systematically debug issues using log evidence and graph-powered code navigation. Trigger on /debug.
---

# Systematic Debugging Workflow

Use this skill to diagnose and fix runtime errors, test failures, or unexpected UI behavior.

## Debugging Protocol (Mandatory Rules)

1. **Log & Traceback Inspection First**:
   - Inspect full error log before forming a hypothesis.
   - Run tests with failure filters: `npm test 2>&1 | grep -A5 -E "FAIL|ERROR"`.

2. **Graph Navigation Strategy**:
   - `semantic_search_nodes_tool`: Find entry points, handlers, or error symbols.
   - `query_graph_tool`: Trace `callers_of` and `callees_of` to isolate failure propagation paths.
   - `detect_changes_tool`: Analyze recent file modifications that correlated with the failure.
   - `get_impact_radius_tool`: Evaluate affected modules before committing code fixes.

3. **Verification & Root Cause Elimination**:
   - Fix the underlying cause rather than masking symptoms or wrapping calls in empty `try/catch` blocks.
   - Run verification tests to confirm the issue is completely resolved.

## Token Efficiency Rules
- Always begin with `get_minimal_context(task="<your task>")`.
- Keep tool calls under 5 actions and total context output under 800 tokens.
