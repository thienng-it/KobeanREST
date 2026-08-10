---
name: clear
description: Reset temporary working context, clean scratch files, and output a fresh session state. Trigger on /clear or /reset.
---

# Session Clear Workflow (`/clear`, `/reset`)

Use this skill when the user types `/clear` or `/reset` to clean temporary session scratch files, reset active working state, and present a fresh turn state.

## Protocol

1. **Scratch & Temp File Cleanup**:
   - Clear temporary scratch scripts and build log buffers.
2. **State Preservation**:
   - Ensure all key technical invariants are stored in project artifacts (`implementation_plan.md` / `walkthrough.md`).
3. **Clean Reset Output**:
   - Output an ultra-concise status reset notification.

## Token Budget & Constraints
- Maximum 1 tool call.
- Zero conversational filler.
