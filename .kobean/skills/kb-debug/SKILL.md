---
name: kb-debug
description: >-
  Systematic root-cause debugging and regression fixing. Use when investigating
  failing tests, runtime errors, stack traces, regressions, or broken behavior
  to reproduce the failure, prove the root cause, write a failing regression
  test, and apply the smallest fix.
---

# `kb-debug` — Systematic Root-Cause Debugging

Distilled from **Superpowers** (`systematic-debugging`, `test-driven-development`), **Trail of Bits** (`regression-hunt`, `patching-bugs`, `post-patch-validation`), and **Ponytail** (`full` minimal-change mode).

## Active Role Loaded by This Skill
- [`~/.kobean/roles/debugger.yaml`](../../roles/debugger.yaml)

---

## Iron Law of `kb-debug`

> **NEVER apply a speculative code edit before reproducing or proving the root cause.** Guess-and-check patching masks bugs and creates regressions.

## Procedure

### Phase 1: Reproduce & Observe
1. Read the exact error message, stack trace, failing test output, or browser console/network log (`chrome-devtools-mcp` if a web UI bug).
2. Run the smallest command that reliably reproduces the failure.
3. If the bug is a regression, check recent history (`git log -n 10 --oneline`, `git diff`) to isolate when the behavior changed.

### Phase 2: Trace & Form a Single Hypothesis
1. Trace the data flow backward from the point of failure to the origin of the bad state.
2. Check **every caller** of the affected function using `graphify` or `grep` (Ponytail rule: fix the root cause once in shared code, not via defensive band-aids at one call site).
3. State your root-cause hypothesis in 1–2 sentences and verify it against the code or a minimal diagnostic log. If 2 hypotheses fail in a row, stop and re-examine the architecture instead of stacking patches.

### Phase 3: Regression Test First (RED)
1. Write an automated test in `tests/` that reproduces the exact bug and fails with the observed error.
2. If `.beads/` is active in the repository, claim or create the bug bead:
   ```bash
   bd create "Fix: <bug summary>" -t bug -p 1
   ```

### Phase 4: Minimal Fix & Blast-Radius Verification (GREEN)
1. Apply the **smallest complete fix** that resolves the root cause.
2. Remove any temporary diagnostic logs added during Phase 2.
3. Run the new regression test **plus** the full test suite for all callers touching the modified module.
4. Close the Bead issue (`bd close <id> --reason "Root cause: ...; fixed in ..."`).

## Output Format
1. **Root Cause:** 1-paragraph explanation of *why* the bug happened.
2. **Fix & Regression Test:** Links to the modified file(s) and new test.
3. **Ponytail Footer:** Callers checked, what was skipped, and any residual risk.

