# Release QA Checklist

Use this checklist before publishing KobeanREST as a public desktop release. The goal is simple: confirm the app behaves like a local desktop product without an account.

## Setup

- Install the tagged build from GitHub Releases for the platform under test.
- Keep `SHA256SUMS.txt` nearby so the downloaded installer can be verified first.
- Use a reachable API for request smoke tests.
  Example: `https://httpbin.org`.
- Remember that the sample workspace ships with placeholder domains, so update the active environment before the valid-request test.

## Desktop launch smoke test

- Launch the installed app from the normal OS entry point.
- Confirm the main window opens without a KobeanREST login, registration, or account prompt.
- Confirm the seeded workspace loads and the app does not crash on first paint.

## Offline launch test

- Disconnect the machine from the network.
- Launch the app again.
- Confirm the app remains usable offline and does not block on startup networking.
- Open Settings and confirm update-check failures stay non-blocking.

## Valid request send test

- Set the active environment `baseUrl` to `https://httpbin.org`.
- Send a saved `GET` request to a reachable endpoint such as `/get`.
- Confirm the response renders status, headers, and body.
- Confirm a history row is created for the successful request.

## Failed request UX test

- Send a request to an invalid host or unreachable URL.
- Confirm the UI shows a failure state instead of stale preview data.
- Confirm the error message is readable and does not reveal secrets.

## Save/reopen persistence test

- Edit a request name or URL and save it.
- Create or update an environment variable.
- Close the app completely, then reopen it.
- Confirm the saved request and environment changes persist after restart.

## Import/export round trip test

- Export the workspace.
- Inspect the export file and confirm secrets remain outside SQLite and exported secret values stay redacted.
- Import that export into a fresh local app state.
- Confirm requests, folders, and non-secret variables round-trip correctly.

## Update offline failure test

- Keep the machine offline.
- Open Settings and use `Check now`.
- Confirm the app reports a non-blocking update failure or release-readiness message and remains usable.

## Installer smoke tests

### macOS

- Open the `.dmg`, drag the app into `Applications`, and launch it.

### Windows

- Run the `.msi`, complete the installer, and launch the installed app.

### Linux

- Launch the `.AppImage` after `chmod +x`.
- Install the `.deb` on a Debian-based system when that package is part of the release.

For every platform under test, confirm the installer or packaged app launches and reaches the main window.
