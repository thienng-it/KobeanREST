import type { DocsPageContent } from "./shared";

export const roadmapContent: DocsPageContent = {
  eyebrow: "Roadmap",
  title: "MVP phases are tracked as verified product slices.",
  description:
    "The roadmap records what is built, what was verified, and what must stay outside the local-only product boundary.",
  sections: [
    {
      id: "completed",
      title: "Completed scope",
      intro: "The current roadmap marks phases 1A through 1P complete.",
      items: [
        "Native desktop readiness",
        "Native REST execution",
        "SQLite persistence",
        "Secure secret boundary",
        "Environment variable resolution",
        "Import and export",
        "Editable workspace UI",
        "Environment editor",
        "API request authentication",
        "History viewer",
        "Settings",
        "Auto update flow",
        "Packaging and release hardening",
        "Download docs finalization",
        "Security and privacy hardening",
        "End-to-end QA",
      ],
    },
    {
      id: "boundaries",
      title: "Product boundaries",
      intro: "KobeanREST remains a local-only desktop REST client.",
      items: [
        "No KobeanREST login, logout, registration, hosted identity service, user profile, or cloud session.",
        "API request authentication is in scope because users need to authenticate to target APIs.",
        "Update checks must be optional, signed, and user-controlled.",
        "Public downloads are distributed through GitHub Releases.",
      ],
    },
    {
      id: "known-gap",
      title: "Current known gap",
      intro:
        "Seeded sample URLs point at placeholder domains. Native requests may fail until users point the active environment at a reachable API.",
    },
  ],
};
