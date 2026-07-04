# Release Operations

This runbook covers the remaining external work for the two in-progress phases:

- Phase `1L`: Auto Update Flow
- Phase `1M`: Packaging and Release Hardening

The app code and GitHub workflow are already wired. What remains is release signing, secret setup, tagged publishing, and post-release verification.

## 1. Generate the updater signing keypair

Run the local Tauri signer command from the repo root:

```bash
node_modules/.bin/tauri signer generate -w ~/.kobeanrest/tauri-updater.key
```

You will receive:

- A private key file at the path you chose.
- A public key printed by the signer.

Keep the private key out of the repo. The public key is the value that replaces `REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY_BEFORE_PUBLIC_RELEASE` in `src-tauri/tauri.conf.json`.

## 2. Update `tauri.conf.json`

Replace the placeholder public key in `src-tauri/tauri.conf.json`:

```json
"pubkey": "REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY_BEFORE_PUBLIC_RELEASE"
```

with the real public key produced by `node_modules/.bin/tauri signer generate`.

Do not commit the private key.

## 3. Configure GitHub Actions secrets

Add these GitHub Actions secrets in the repository settings:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

`TAURI_SIGNING_PRIVATE_KEY` should be the full private key contents.
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` should match the password used during key generation.

These are the secret names already consumed by `.github/workflows/release.yml`.

## 4. Run local verification before tagging

Run the standard checks plus the source/config secret scan:

```bash
npm run check:release
npm run check:secrets
npm test
npm run build
source /Users/josephnguyen/.cargo/env && npm run check:native
source /Users/josephnguyen/.cargo/env && cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

`npm run check:release` should pass before you create a tag. It is the offline preflight for the release workflow wiring and should fail only when the updater config or release workflow drifted.

## 5. Create and push the release tag

Create a semver tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

If you are publishing a later release, use the correct version tag instead of `v0.1.0`.
If you prefer to push all local release tags at once, `git push origin --tags` also works.

This triggers `.github/workflows/release.yml`, which should:

- build macOS `.dmg`
- build Windows `.msi`
- build Linux `.AppImage`
- build optional Linux `.deb`
- publish `latest.json`
- publish `SHA256SUMS.txt`

## 6. Verify the draft GitHub Release

After the workflow finishes, confirm the draft release includes:

- platform artifacts for macOS, Windows, and Linux
- `latest.json`
- `SHA256SUMS.txt`

Confirm the checksum file matches the published artifacts.

## 7. Verify the in-app updater

Install the current app build, then use the checklist in `docs/release-qa.md`.

Focus on these updater checks:

- Open Settings and use `Check now`.
- Confirm the update prompt appears when a newer signed release exists.
- Confirm the prompt references signed release metadata.
- Confirm offline update checks stay non-blocking.

## 8. Mark the roadmap complete

Only after the real release succeeds:

- Mark Phase `1L` complete once the real public key is committed and the updater is verified against signed `latest.json`.
- Mark Phase `1M` complete once the tagged GitHub Release publishes the artifacts and `SHA256SUMS.txt` successfully for macOS, Windows, and Linux.
