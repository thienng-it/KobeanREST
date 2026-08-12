import { useState, useEffect } from "react";
import { releasesUrl } from "../site";
import type { DocsPageContent } from "./shared";

function useLatestVersion() {
  const [version, setVersion] = useState("0.1.23");
  useEffect(() => {
    fetch("https://api.github.com/repos/thienng-it/KobeanREST/releases/latest")
      .then(res => res.json())
      .then(data => {
        if (data.tag_name) {
          setVersion(data.tag_name.replace(/^v/, ""));
        }
      })
      .catch(console.error);
  }, []);
  return version;
}

function DownloadSection() {
  const version = useLatestVersion();
  const baseUrl = "https://github.com/thienng-it/KobeanREST/releases/latest/download";
  const checksumUrl = `${baseUrl}/SHA256SUMS.txt`;

  const downloadCards = [
    {
      platform: "macOS",
      artifact: "Universal DMG",
      file: `KobeanREST_${version}_universal.dmg`,
      href: `${baseUrl}/KobeanREST_${version}_universal.dmg`,
      note: "Open the DMG, drag KobeanREST to Applications, then launch it.",
    },
    {
      platform: "Windows",
      artifact: "MSI installer",
      file: `KobeanREST_${version}_x64_en-US.msi`,
      href: `${baseUrl}/KobeanREST_${version}_x64_en-US.msi`,
      note: "Run the installer, then launch KobeanREST from the Start menu.",
    },
    {
      platform: "Linux",
      artifact: "AppImage",
      file: `KobeanREST_${version}_amd64.AppImage`,
      href: `${baseUrl}/KobeanREST_${version}_amd64.AppImage`,
      note: "Make it executable, then run the portable app directly.",
    },
    {
      platform: "Linux",
      artifact: "Debian package",
      file: `KobeanREST_${version}_amd64.deb`,
      href: `${baseUrl}/KobeanREST_${version}_amd64.deb`,
      note: "Install with your package manager on Debian-based systems.",
    },
  ];

  return (
    <div className="download-intro">
      <p>
        Choose your operating system below for the fastest path. No KobeanREST account, cloud workspace, or server setup
        is required. The public source of truth remains{" "}
        <a href={releasesUrl} target="_blank" rel="noreferrer">
          GitHub Releases
        </a>
        , and each release should include platform artifacts, <code>SHA256SUMS.txt</code>, and signed Tauri update
        metadata as <code>latest.json</code>.
      </p>
      <div className="download-grid">
        {downloadCards.map((card) => (
          <article className="download-card" key={card.file}>
            <span>{card.platform}</span>
            <h3>{card.artifact}</h3>
            <p>{card.note}</p>
            <code>{card.file}</code>
            <a className="download-button" href={card.href}>
              Download {card.platform}
            </a>
          </article>
        ))}
      </div>
      <div className="download-actions">
        <a href={checksumUrl}>Download SHA256SUMS.txt</a>
        <a href={releasesUrl} target="_blank" rel="noreferrer">
          View all release files
        </a>
      </div>
    </div>
  );
}

function CLISection() {
  const version = useLatestVersion();
  const baseUrl = "https://github.com/thienng-it/KobeanREST/releases/latest/download";
  const checksumUrl = `${baseUrl}/SHA256SUMS.txt`;

  const cliCommands = [
    {
      label: "macOS",
      command: `curl -L -o KobeanREST.dmg ${baseUrl}/KobeanREST_${version}_universal.dmg`,
    },
    {
      label: "Windows PowerShell",
      command: `Invoke-WebRequest -Uri ${baseUrl}/KobeanREST_${version}_x64_en-US.msi -OutFile KobeanREST.msi`,
    },
    {
      label: "Linux AppImage",
      command: `curl -L -o KobeanREST.AppImage ${baseUrl}/KobeanREST_${version}_amd64.AppImage && chmod +x KobeanREST.AppImage`,
    },
    {
      label: "Linux deb",
      command: `curl -L -o KobeanREST.deb ${baseUrl}/KobeanREST_${version}_amd64.deb`,
    },
    {
      label: "Checksums",
      command: `curl -L -o SHA256SUMS.txt ${checksumUrl}`,
    },
  ];

  return (
    <div className="command-grid">
      {cliCommands.map((entry) => (
        <div className="command-card" key={entry.label}>
          <strong>{entry.label}</strong>
          <code>{entry.command}</code>
        </div>
      ))}
    </div>
  );
}

export const downloadsContent: DocsPageContent = {
  eyebrow: "Downloads",
  title: "Install from public GitHub Releases.",
  description:
    "Public installers and signed updater metadata are distributed through the latest KobeanREST GitHub Release.",
  sections: [
    {
      id: "latest",
      title: "Latest release",
      body: <DownloadSection />
    },
    {
      id: "first-run",
      title: "First run",
      intro:
        "After installation, open KobeanREST and start building requests locally. The app stores workspace data on your machine.",
      items: [
        "macOS: if Gatekeeper shows a trust prompt, open the app from Finder once and confirm you want to run it.",
        "Windows: if SmartScreen appears, confirm the installer only if you downloaded it from the official GitHub Release.",
        "Linux: AppImage needs execute permission; the deb package installs through the system package manager.",
      ],
    },
    {
      id: "platforms",
      title: "Platform artifacts",
      intro: "Release CI produces downloadable desktop artifacts for supported operating systems.",
      items: [
        "macOS: universal DMG where release signing supports it.",
        "Windows: MSI installer generated by release CI.",
        "Linux: AppImage portable build.",
        "Linux: optional Debian package for supported distributions.",
      ],
    },
    {
      id: "checksums",
      title: "Checksum verification",
      intro: "Verify the downloaded file against the matching line in SHA256SUMS.txt before opening an installer.",
      body: (
        <div className="code-stack">
          <code>macOS: shasum -a 256 KobeanREST.dmg</code>
          <code>Windows: certutil -hashfile KobeanREST.msi SHA256</code>
          <code>Linux: sha256sum KobeanREST.AppImage</code>
        </div>
      ),
    },
    {
      id: "command-line",
      title: "Command-line downloads",
      intro: "Use these commands when downloading from a terminal or setup script.",
      body: <CLISection />,
    },
    {
      id: "updates",
      title: "Update behavior",
      intro:
        "Update checks use public signed release metadata and do not require login, registration, or a hosted account.",
      items: [
        "Automatic update checks are optional and controlled from app settings.",
        "Manual update checks are available through the app settings flow.",
        "The app remains usable offline when update checks fail or are disabled.",
      ],
    },
  ],
};
