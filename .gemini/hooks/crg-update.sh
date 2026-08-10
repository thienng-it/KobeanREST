#!/usr/bin/env bash
# code-review-graph: incremental update after write/replace (Gemini CLI hook)
# Must output ONLY JSON on stdout. Low-noise: no systemMessage.
set -euo pipefail

cat > /dev/null || true

REPO_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
code-review-graph update --skip-flows --repo "$REPO_DIR" >/dev/null 2>&1 || true
echo '{"suppressOutput": true}'
exit 0
