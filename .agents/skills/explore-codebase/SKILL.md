---
name: explore-codebase
description: Navigate and understand codebase structure using graph analysis tools. Trigger on /explore.
---

# Codebase Exploration Workflow

Use this skill when onboarding to a new module, understanding structural dependencies, or tracing architectural flows.

## Navigation Protocol

1. **Architecture Overview**:
   - Run `get_architecture_overview_tool` to understand top-level community clusters.
   - Run `list_communities_tool` to identify core modules (`renderer`, `tauri-core`, `vscode-extension`).

2. **Targeted Relationship Queries**:
   - Use `semantic_search_nodes_tool` to locate target classes, components, or services.
   - Use `query_graph_tool` with patterns:
     - `imports_of` / `imported_by`: Understand module boundaries.
     - `callers_of` / `callees_of`: Understand execution chains.
     - `tests_for`: Identify covering test contracts in `tests/*.test.mjs`.

3. **Flow Tracing**:
   - Use `list_flows` and `get_flow` to inspect full request execution paths (e.g. UI event -> Request Executor -> Tauri IPC -> HTTP client).

## Token Efficiency Standard
- Start with `get_minimal_context(task="<task>")`.
- Use `detail_level="minimal"` to minimize prompt size.
- Maximum 5 tool calls per exploration phase.
