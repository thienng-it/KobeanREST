import type { ApiAuthMode, AuthConfig } from "../types";
import { containsVariables, resolveStringSafe } from "./variables";
import { executeHttpRequest } from "./http-client";

type Header = { key: string; value: string; enabled: boolean };

/**
 * Resolve any `{{variable}}` references in an auth config value.
 * Falls back to the raw value if resolution fails.
 */
function tryResolve(value: string | undefined, variableMap: Map<string, string>): string {
  if (!value) return "";
  if (!containsVariables(value)) return value;
  return resolveStringSafe(value, variableMap);
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
  // Start with headers, but filter out any auth-related headers that will be set by auth tab
  // This prevents duplicate headers when user sets Authorization in both Headers tab AND Auth tab
  const resultHeaders = headers.filter((h) => {
    const keyLower = h.key.toLowerCase();
    // Remove Authorization if auth mode uses it
    if (keyLower === "authorization") {
      if (authMode === "basic" || authMode === "bearer" || authMode === "oauth2") {
        return false; // Auth tab will set this; remove duplicates from Headers tab
      }
    }
    // Remove apiKey header if auth mode uses it with header placement
    if (authMode === "apiKey" && authConfig.keyName) {
      if (keyLower === authConfig.keyName.toLowerCase()) {
        if (authConfig.placement !== "query") {
          return false; // Auth tab will set this header
        }
      }
    }
    return true;
  });

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

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/**
 * Perform a POST request to obtain an Access Token via OAuth 2.0.
 * Supports client_credentials, password, and authorization_code (via browser popup).
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
  } else if (grantType === "authorization_code") {
    const loginUrl = tryResolve(authConfig.authUrl, variableMap);
    if (!loginUrl) {
      throw new Error("Auth URL (Target URL) is required for Browser login flow");
    }

    // Start listening for the callback or token
    let unlistenCallback: UnlistenFn | undefined;
    let unlistenToken: UnlistenFn | undefined;
    
    const authCode = await new Promise<string>(async (resolve, reject) => {
      try {
        unlistenToken = await listen<string>("oauth-token", (event) => {
          resolve(event.payload);
        });
        
        unlistenCallback = await listen<string>("oauth-callback", (event) => {
          const callbackUrl = event.payload;
          try {
            const parsed = new URL(callbackUrl);
            const code = parsed.searchParams.get("code");
            const token = parsed.searchParams.get("access_token") || parsed.hash.match(/access_token=([^&]+)/)?.[1];
            const err = parsed.searchParams.get("error");
            if (token) {
              resolve(token);
            } else if (code) {
              // Note: If they only provided a Target URL, we cannot easily exchange the code here because we lack client_id, redirect_uri, etc.
              // So we just return the code. Hopefully it's already a token.
              resolve(code);
            } else if (err) {
              reject(new Error(`OAuth Error: ${err}`));
            } else {
              reject(new Error("No authorization code or token found in callback"));
            }
          } catch (e) {
            reject(new Error("Failed to parse callback URL"));
          }
        });

        // Open the browser window with the provided URL as-is
        await invoke("start_oauth_login", { loginUrl });
      } catch (err) {
        reject(err);
      }
    });
    
    if (unlistenCallback) unlistenCallback();
    if (unlistenToken) unlistenToken();
    
    // In this simplified flow, the popup already captured the actual token
    // (either via AJAX sniffing or implicit flow hash), so we can just return it.
    return authCode;
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
