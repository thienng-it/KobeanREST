import type { ApiAuthMode, AuthConfig } from "../types";
import { resolveString, containsVariables } from "./variables";
import { executeHttpRequest } from "./http-client";

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
    grantType: authConfig.grantType,
    accessTokenUrl: tryResolve(authConfig.accessTokenUrl, variableMap) || undefined,
    clientId: tryResolve(authConfig.clientId, variableMap) || undefined,
    clientSecret: tryResolve(authConfig.clientSecret, variableMap) || undefined,
    scope: tryResolve(authConfig.scope, variableMap) || undefined,
    audience: tryResolve(authConfig.audience, variableMap) || undefined,
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

/**
 * Perform a POST request to obtain an Access Token via OAuth 2.0 (Client Credentials or Password grant).
 */
export async function obtainOAuth2Token(
  authConfig: AuthConfig,
  variableMap: Map<string, string>,
): Promise<string> {
  const url = tryResolve(authConfig.accessTokenUrl, variableMap);
  if (!url) {
    throw new Error("Access Token URL is required");
  }

  const grantType = authConfig.grantType ?? "client_credentials";
  const clientId = tryResolve(authConfig.clientId, variableMap);
  const clientSecret = tryResolve(authConfig.clientSecret, variableMap);
  const scope = tryResolve(authConfig.scope, variableMap);
  const audience = tryResolve(authConfig.audience, variableMap);

  const params = new URLSearchParams();
  params.append("grant_type", grantType);

  if (grantType === "password") {
    const username = tryResolve(authConfig.username, variableMap);
    const password = tryResolve(authConfig.password, variableMap);
    params.append("username", username);
    params.append("password", password);
  }

  if (scope) {
    params.append("scope", scope);
  }
  if (audience) {
    params.append("audience", audience);
  }

  const headers: Array<{ key: string; value: string; enabled: boolean }> = [
    { key: "Content-Type", value: "application/x-www-form-urlencoded", enabled: true }
  ];

  if (clientId && clientSecret) {
    try {
      const encoded = btoa(`${clientId}:${clientSecret}`);
      headers.push({ key: "Authorization", value: `Basic ${encoded}`, enabled: true });
    } catch (e) {
      // If btoa fails, fallback to sending in body
      params.append("client_id", clientId);
      params.append("client_secret", clientSecret);
    }
  } else if (clientId) {
    params.append("client_id", clientId);
  }

  const response = await executeHttpRequest({
    method: "POST",
    url,
    headers,
    body: params.toString(),
    bodyMimeType: "application/x-www-form-urlencoded",
    timeoutMs: 30000,
    followRedirects: true,
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Failed to obtain token (HTTP ${response.status}): ${response.bodyText || response.statusText}`);
  }

  const data = JSON.parse(response.bodyText || "{}");
  if (data.access_token) {
    return data.access_token;
  } else if (data.token) {
    return data.token;
  } else {
    throw new Error("Response did not contain an access_token");
  }
}
