---
name: ai-pipeline-integration
description: Configure, validate, and maintain automated AI developer loop pipelines (.ai-pipeline.yml). Trigger on /ai-pipeline.
---

# AI Pipeline Integration Workflow

Use this skill when managing `.ai-pipeline.yml` automated agent loops, GitHub PR triggers, and Docker sandbox guardrails.

## Pipeline Architecture (`.ai-pipeline.yml`)

1. **Sandbox & Isolation**:
   - Docker container isolation with defined execution timeouts (`timeout_seconds`).

2. **Guardrail Enforcements**:
   - `ponytail_strict`: Enforces strict diff validation before PR creation.
   - `max_diff_lines`: Caps total lines modified per autonomous session (e.g. 500 lines).
   - `allow_new_deps`: Controls whether agents can introduce new npm or cargo dependencies.

3. **Multi-Agent Orchestration**:
   - Planner Model: Strategic analysis and plan generation.
   - Coder Model: Code generation and editing.
   - Reviewer Model: Automated risk scoring and validation.

4. **GitHub Integration**:
   - `trigger_label`: Auto-invokes AI pipeline when specified label is applied.
   - `comment_trigger`: Mentions like `@ai-pipeline fix` trigger automated bug-fixing subagents.

## Validation Steps
- Verify YAML schema validity in `.ai-pipeline.yml`.
- Ensure guardrail limits align with repository code review policies.
