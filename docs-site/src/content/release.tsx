import { commands } from "./shared";
import type { DocsPageContent } from "./shared";

export const releaseContent: DocsPageContent = {
  eyebrow: "Release",
  title: "Signed releases through GitHub Actions.",
  description:
    "The release flow builds desktop artifacts, publishes checksums, and ships signed updater metadata through GitHub Releases.",
  sections: [
    {
      id: "preflight",
      title: "Local preflight",
      intro: "Run the release and secret scans before creating a release tag.",
      body: (
        <div className="code-stack">
          <code>{commands.releaseCheck}</code>
          <code>{commands.secretsCheck}</code>
          <code>{commands.test}</code>
          <code>{commands.build}</code>
        </div>
      ),
    },
    {
      id: "signing",
      title: "Signing context",
      intro: "The updater public key is committed in Tauri config. The private signing material stays out of the repo.",
      items: [
        "TAURI_SIGNING_PRIVATE_KEY stores the private key in GitHub Actions secrets.",
        "TAURI_SIGNING_PRIVATE_KEY_PASSWORD matches the password used during key generation.",
        "The release workflow passes signing secrets only during artifact build.",
      ],
    },
    {
      id: "publishing",
      title: "Publishing flow",
      intro: "A semver tag triggers the release workflow.",
      items: [
        "Create a tag that matches the app version, such as v0.1.1.",
        "Release CI builds macOS, Windows, and Linux artifacts.",
        "The checksums job uploads SHA256SUMS.txt to the draft GitHub Release.",
        "latest.json provides signed updater metadata.",
      ],
    },
    {
      id: "post-release",
      title: "Post-release verification",
      intro: "After the workflow finishes, verify the release as a user would consume it.",
      items: [
        "Confirm platform artifacts exist for macOS, Windows, and Linux.",
        "Confirm SHA256SUMS.txt matches the uploaded artifacts.",
        "Install the current app build and use Settings > Check now for updater validation.",
        "Run the release QA checklist before publishing broadly.",
      ],
    },
  ],
};
