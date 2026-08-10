---
name: compact
description: Compact conversation context, extract key codebase decisions, active state, and pending tasks into a token-efficient summary. Trigger on /compact or /summarize.
---

# Context & Memory Compaction Skill (`/compact`, `/summarize`)

Use this skill when the user types `/compact` or `/summarize` to summarize working memory, save active context into project artifacts, and free up prompt tokens.

## Execution Workflow

1. **Active Context Extraction**:
   - Synthesize recent architectural changes, refactorings, and decisions made during the current conversation.
   - Identify active/open tasks, pending verifications, and modified files.

2. **Artifact & State Preservation**:
   - Save or update key technical decisions in project artifacts (`implementation_plan.md`, `walkthrough.md`, or `.gemini/` skills).
   - Clean up scratch files and temporary test outputs.

3. **High-Density Status Snapshot**:
   - Generate a concise status table summarizing:
     - **Active Tasks**: Completed vs. pending goals.
     - **Modified Files**: List of modified files with links.
     - **Architectural Notes**: Critical invariants or contracts established.
     - **Next Action Items**: Concise list of immediate next steps.

## Token Budget & Constraints

- Maximum 2 tool calls.
- Output high-density, zero-filler Markdown summary.
