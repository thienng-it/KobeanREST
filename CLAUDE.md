# Token Saving Directives
- CRITICAL: Never explain the code you are writing.
- Output ONLY the necessary shell commands or code edits.
- Do not use conversational filler, greetings, or apologies (e.g., skip "Here is the code", "I understand", "Let me fix that").
- When running tests or reading logs, ALWAYS pipe the output through grep to find errors rather than dumping the whole file (e.g., `npm test 2>&1 | grep -A5 -E "FAIL|ERROR"`).

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes_tool` or `query_graph_tool` instead of Grep
- **Understanding impact**: `get_impact_radius_tool` instead of manually tracing imports
- **Code review**: `detect_changes_tool` + `get_review_context_tool` instead of reading entire files
- **Finding relationships**: `query_graph_tool` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview_tool` + `list_communities_tool`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes_tool` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context_tool` | Need source snippets for review — token-efficient |
| `get_impact_radius_tool` | Understanding blast radius of a change |
| `get_affected_flows_tool` | Finding which execution paths are impacted |
| `query_graph_tool` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes_tool` | Finding functions/classes by name or keyword |
| `get_architecture_overview_tool` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes_tool` for code review.
3. Use `get_affected_flows_tool` to understand impact.
4. Use `query_graph_tool` pattern="tests_for" to check coverage.

## Project rules

See @docs/agent-rules.md and @README.md for the product contract, local-only/secret-handling rules, and standard verification commands. Those files are the source of truth; do not restate them here.

## .claude structure

- `.claude/settings.json` — permission allowlist/denylist and the code-review-graph hooks.
- `.claude/agents/` — subagents: `security-reviewer`, `rust-core-reviewer`, `release-qa-reviewer`, `docs-portal-reviewer`. Invoke explicitly, e.g. "use a subagent to review this for security issues".
- `.claude/skills/` — `/explore-codebase`, `/review-changes`, `/debug-issue`, `/refactor-safely` (graph-powered workflows), plus project workflows `/release-preflight`, `/secret-scan`, `/fix-issue`.
- Personal, un-shared notes go in `CLAUDE.local.md` (gitignored), not here.
