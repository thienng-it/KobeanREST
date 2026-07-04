# Known Issues and Awareness Notes

Track user-visible problems, implementation risks, and things agents must remember while building KobeanREST.

## Native Send Fails For Unresolved Variables

Status: resolved (Phase 1E).

Resolution:
- Variables are resolved from the active environment before calling the native HTTP client.
- Unresolved variables block request execution and show a clear `Unresolved variable: <name>` error.
- The `resolveRequestVariables` function in `src/renderer/src/services/variables.ts` handles resolution.

## Error State Can Show Stale Preview Response

Status: resolved (Phase 1E).

Resolution:
- Error state no longer carries a previous response object.
- The response heading shows `Request failed` instead of stale `200 Preview OK`.
- The response body shows `// No response — see error above.` instead of stale data.

## Placeholder Sample URLs

Status: accepted for now.

Note:
- Seeded environment URLs are examples.
- After variable resolution is implemented, native sends may fail unless the user points the environment to a reachable API.

Possible later improvement:
- Provide a demo workspace using a stable public HTTP test endpoint.

## Release Verification Scope

Status: ongoing.

Before public release:
- Verify fresh install launches without account setup.
- Verify offline launch.
- Verify update checks fail gracefully offline.
- Verify SQLite does not contain raw secret values.
- Verify exported workspaces redact secrets.
- Verify platform artifacts and checksums match docs.
