import { commands } from "./shared";
import type { DocsPageContent } from "./shared";

export const developerContent: DocsPageContent = {
  eyebrow: "Developer",
  title: "Work on the desktop app with one local toolchain.",
  description:
    "KobeanREST uses a React renderer, Tauri 2 desktop shell, Rust native core, SQLite persistence, and local secret boundaries.",
  sections: [
    {
      id: "stack",
      title: "Stack",
      items: [
        "Desktop shell: Tauri 2",
        "Native core: Rust",
        "Frontend: React, Vite, TypeScript",
        "Local persistence: SQLite through the native core",
        "Secret storage: operating-system keychain first, encrypted vault fallback",
        "Updates: signed Tauri updater metadata from public release artifacts",
      ],
    },
    {
      id: "setup",
      title: "Local setup",
      body: (
        <div className="code-stack">
          <code>{commands.install}</code>
          <code>{commands.test}</code>
          <code>npm run dev</code>
          <code>npm run tauri dev</code>
        </div>
      ),
    },
    {
      id: "architecture",
      title: "Architecture",
      intro:
        "The renderer owns user interaction and browser-preview fallbacks. The native core is authoritative for desktop runtime behavior.",
      items: [
        "Request execution routes through the Rust native HTTP client in desktop mode.",
        "Workspace data is loaded from SQLite after persistence initialization.",
        "Secret writes go through the secret service boundary before metadata is stored.",
        "Settings and update checks preserve offline-first behavior.",
      ],
    },
    {
      id: "verification",
      title: "Core verification commands",
      body: (
        <div className="code-stack">
          <code>{commands.test}</code>
          <code>{commands.build}</code>
          <code>{commands.nativeCheck}</code>
          <code>{commands.cargoFmt}</code>
        </div>
      ),
    },
  ],
};
