---
name: clear
description: Reset temporary working context, clean session scratch files, and start fresh context. Trigger on /clear or /reset.
---

# Session Clear Workflow (`/clear`, `/reset`)

When `/clear` or `/reset` is triggered:

1. **Context & Scratch Reset**:
   - Resets active agent prompt working memory.
   - Cleans temporary scratch files and test log buffers.
2. **UI Note**:
   - Notifies the user that active working memory context has been cleared.
   - (Visual chat UI history can also be reset using the IDE's "New Chat" / "+" button).
