import {
  BookOpen,
  Boxes,
  Download,
  GitBranch,
  Home,
  Rocket,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SiteRoute = "home" | "product" | "downloads" | "developer" | "release" | "roadmap" | "qa";

export interface NavItem {
  route: SiteRoute;
  label: string;
  href: string;
  description: string;
  icon: LucideIcon;
}

export const docsPortalUrl = "https://thienng-it.github.io/KobeanREST/";
export const webAppUrl = "https://thienng-it.github.io/KobeanREST/app/";
export const releasesUrl = "https://github.com/thienng-it/KobeanREST/releases/latest";
export const repoUrl = "https://github.com/thienng-it/KobeanREST";

export const navItems: NavItem[] = [
  {
    route: "home",
    label: "Home",
    href: "#/",
    description: "Start from the portal overview.",
    icon: Home,
  },
  {
    route: "product",
    label: "Product",
    href: "#/product",
    description: "Understand the local-first REST client.",
    icon: BookOpen,
  },
  {
    route: "downloads",
    label: "Downloads",
    href: "#/downloads",
    description: "Installers, checksums, and update behavior.",
    icon: Download,
  },
  {
    route: "developer",
    label: "Developer",
    href: "#/developer",
    description: "Setup, architecture, and development commands.",
    icon: TerminalSquare,
  },
  {
    route: "release",
    label: "Release",
    href: "#/release",
    description: "Signing, release workflow, and verification.",
    icon: Rocket,
  },
  {
    route: "roadmap",
    label: "Roadmap",
    href: "#/roadmap",
    description: "Completed phases and current product scope.",
    icon: GitBranch,
  },
  {
    route: "qa",
    label: "QA & Issues",
    href: "#/qa",
    description: "Release QA checklist and known issues.",
    icon: ShieldCheck,
  },
];

export const portalStats = [
  { label: "Desktop runtime", value: "Tauri 2", detail: "Rust native core with React renderer" },
  { label: "Storage model", value: "Local-first", detail: "SQLite data with secrets outside SQLite" },
  { label: "Release model", value: "Signed", detail: "GitHub Releases plus updater metadata" },
  { label: "Project scope", value: "No account", detail: "No login, cloud session, or hosted user backend" },
];

export function parseRoute(hash: string): SiteRoute {
  const normalized = hash.replace(/^#\/?/, "").replace(/^\/+/, "").split("/")[0];
  const routes = new Set<SiteRoute>(navItems.map((item) => item.route));

  if (!normalized) {
    return "home";
  }

  return routes.has(normalized as SiteRoute) ? (normalized as SiteRoute) : "home";
}

export const BrandIcon = Boxes;
