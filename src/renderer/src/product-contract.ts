export const PRODUCT_AUTHENTICATION_MODEL = {
  headline: "Download, launch, use",
  localOnly: true,
  offlineFirst: true,
  accountSystem: "No login, no registration, no hosted user account service.",
  updatePolicy:
    "Automatic update checks are optional, signed, and do not require an account.",
  privacy:
    "KobeanREST stores workspaces, requests, environments, and history locally by default.",
} as const;

export const PRODUCT_DOWNLOADS_URL =
  "https://github.com/thienng-it/KobeanREST/releases/latest" as const;

export const PRODUCT_DOCS_URL =
  "https://thienng-it.github.io/KobeanREST/" as const;

export const OUT_OF_SCOPE = [
  "KobeanREST user accounts",
  "Cloud sync in the MVP",
  "Team collaboration",
  "Hosted project backend",
  "Runtime plugin marketplace",
] as const;
