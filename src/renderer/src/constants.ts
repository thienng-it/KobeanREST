export type ApiAuthMode = "none" | "basic" | "bearer" | "apiKey" | "oauth2" | "ntlm" | "kerberos";

export const AUTH_MODE_MAP: Record<string, ApiAuthMode> = {
  "None": "none",
  "Basic Auth": "basic",
  "Bearer Token": "bearer",
  "API Key": "apiKey",
  "OAuth 2.0": "oauth2",
  "NTLM": "ntlm",
  "Kerberos": "kerberos",
};

export const AUTH_MODE_LABELS: Record<ApiAuthMode, string> = {
  none: "None",
  basic: "Basic Auth",
  bearer: "Bearer Token",
  apiKey: "API Key",
  oauth2: "OAuth 2.0",
  ntlm: "NTLM",
  kerberos: "Kerberos",
};

export const authModes = ["None", "Basic Auth", "Bearer Token", "API Key", "OAuth 2.0", "NTLM", "Kerberos"] as const;
