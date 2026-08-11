---
name: refactor-safely
description: Plan and execute safe refactoring using graph impact analysis and test contract sync
---

# Safe Refactoring Workflow

Use this skill when renaming symbols, reorganizing component hierarchies, or modifying core signatures.

## Refactoring Protocol

1. **Impact Analysis**:
   - Run `get_impact_radius_tool` on target files to isolate all dependent modules.
   - Run `get_affected_flows_tool` to ensure critical execution paths are mapped.

2. **Renaming & Restructuring**:
   - Use `refactor_tool` with `mode="preview"` before committing edits.
   - Preview list of affected imports, types, and function calls.

3. **Contract Synchronization**:
   - Search `tests/*.test.mjs` for regex patterns referencing refactored source code symbols (`assert.match`).
   - Update contract regexes synchronously alongside source changes.

4. **Post-Refactor Verification**:
   - Run `detect_changes_tool` to review change score.
   - Execute test suite (`npm test 2>&1 | grep -A5 -E "FAIL|ERROR"`).
