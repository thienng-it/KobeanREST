import type { ApiAuthMode, AuthConfig } from "../types";
import { resolveString, containsVariables } from "./variables";

type Header = { key: string; value: string; enabled: boolean };

/**
 * Resolve any `{{variable}}` references in an auth config value.
 * Falls back to the raw value if resolution fails.
 */
function tryResolve(value: string | undefined, variableMap: Map<string, string>): string {
  if (!value) return "";
  if (!containsVariables(value)) return value;
  try {
    return resolveString(value, variableMap).resolved;
  } catch {
    return value;
  }
}

/**
 * Resolve variable references in all auth config fields.
 * Returns a new AuthConfig with resolved values ready for injection.
 */
export function resolveAuthConfig(
  authConfig: AuthConfig,
  variableMap: Map<string, string>,
): AuthConfig {
  return {
    username: tryResolve(authConfig.username, variableMap) || undefined,
    password: tryResolve(authConfig.password, variableMap) || undefined,
    token: tryResolve(authConfig.token, variableMap) || undefined,
    keyName: tryResolve(authConfig.keyName, variableMap) || undefined,
    keyValue: tryResolve(authConfig.keyValue, variableMap) || undefined,
    placement: authConfig.placement,
  };
}

/**
 * Inject authentication credentials into the request URL and headers.
 * Pass already-resolved AuthConfig (no variable references remain).
 *
 * Auth headers are appended after existing headers so they can be
 * distinguished and redacted independently.
 */
export function applyAuth(
  authMode: ApiAuthMode,
  authConfig: AuthConfig,
  url: string,
  headers: Header[],
): { url: string; headers: Header[] } {
  const resultHeaders = [...headers];
  let resultUrl = url;

  switch (authMode) {
    case "basic": {
      const user = authConfig.username ?? "";
      const pass = authConfig.password ?? "";
      if (user || pass) {
        const encoded = btoa(`${user}:${pass}`);
        resultHeaders.push({ key: "Authorization", value: `Basic ${encoded}`, enabled: true });
      }
      break;
    }
    case "bearer":
    case "oauth2": {
      const token = authConfig.token ?? "";
      if (token) {
        resultHeaders.push({ key: "Authorization", value: `Bearer ${token}`, enabled: true });
      }
      break;
    }
    case "apiKey": {
      const keyName = authConfig.keyName ?? "";
      const keyValue = authConfig.keyValue ?? "";
      if (keyName && keyValue) {
        if (authConfig.placement === "query") {
          const sep = resultUrl.includes("?") ? "&" : "?";
          resultUrl = `${resultUrl}${sep}${encodeURIComponent(keyName)}=${encodeURIComponent(keyValue)}`;
        } else {
          resultHeaders.push({ key: keyName, value: keyValue, enabled: true });
        }
      }
      break;
    }
    default:
      break;
  }

  return { url: resultUrl, headers: resultHeaders };
}

/**
 * Redact the auth query parameter from a URL before recording history.
 * Only applies when authMode is "apiKey" with query placement.
 */
export function redactAuthFromUrl(
  url: string,
  authMode: ApiAuthMode,
  authConfig: AuthConfig,
): string {
  if (authMode !== "apiKey" || authConfig.placement !== "query" || !authConfig.keyName) {
    return url;
  }
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has(authConfig.keyName)) {
      parsed.searchParams.set(authConfig.keyName, "[redacted]");
      return parsed.toString();
    }
  } catch {
    // not a valid absolute URL; skip redaction
  }
  return url;
}

/**
 * Redact auth-injected header values before recording history.
 * Always redacts the Authorization header value.
 * For apiKey mode, also redacts the named key header value.
 */
export function redactAuthHeaders(
  headers: Header[],
  authMode: ApiAuthMode,
  authConfig: AuthConfig,
): Header[] {
  return headers.map((h) => {
    if (h.key.toLowerCase() === "authorization") {
      return { ...h, value: "[redacted]" };
    }
    if (
      authMode === "apiKey" &&
      authConfig.keyName &&
      h.key.toLowerCase() === authConfig.keyName.toLowerCase()
    ) {
      return { ...h, value: "[redacted]" };
    }
    return h;
  });
}
