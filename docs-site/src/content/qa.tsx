import type { DocsPageContent } from "./shared";

export const qaContent: DocsPageContent = {
  eyebrow: "QA & Issues",
  title: "Release checks for a real local desktop product.",
  description:
    "The QA checklist focuses on launch behavior, offline use, request execution, persistence, import/export, updates, and installers.",
  sections: [
    {
      id: "smoke",
      title: "Desktop smoke tests",
      items: [
        "Launch the installed app from the normal OS entry point.",
        "Confirm the main window opens without login, registration, or account prompts.",
        "Confirm the seeded workspace loads and first paint does not crash.",
      ],
    },
    {
      id: "offline",
      title: "Offline behavior",
      items: [
        "Disconnect the machine from the network.",
        "Launch the app again.",
        "Confirm the app remains usable offline and does not block on startup networking.",
        "Confirm update-check failures stay non-blocking.",
      ],
    },
    {
      id: "requests",
      title: "Request and persistence checks",
      items: [
        "Set baseUrl to a reachable API such as https://httpbin.org.",
        "Send a saved GET request and confirm response status, headers, and body render.",
        "Confirm successful requests create history rows.",
        "Edit a request or environment variable and confirm the change persists after restart.",
      ],
    },
    {
      id: "known-issues",
      title: "Known issues",
      intro:
        "Seeded environment URLs are examples. After variable resolution, native sends may fail unless the user points the environment to a reachable API.",
      items: [
        "Resolved: unresolved variables now block request execution with a clear error.",
        "Resolved: failed requests no longer show stale preview responses.",
        "Accepted for now: placeholder sample URLs require user adjustment for live requests.",
      ],
    },
  ],
};
