---
name: compact
description: Compact conversation context, extract key codebase decisions into artifacts, and minimize output tokens. Trigger on /compact or /summarize.
---

# Context Compaction Skill (`/compact`)

When the user triggers `/compact`, release token overhead by outputting an ultra-concise snapshot (≤3 lines).

## Protocol
1. Persist state to project artifacts (`implementation_plan.md` / `walkthrough.md`).
2. Output ONLY a minimal 2-line summary snapshot.
