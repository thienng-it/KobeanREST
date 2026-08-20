import type { ApiAuthMode, AuthConfig, SavedRequest, WorkspaceSummary } from "../types";
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

export function getEffectiveAuth(request: SavedRequest, workspace: WorkspaceSummary | null): { mode: ApiAuthMode; config: AuthConfig; source: string; entityId: string | null; entityType: "request" | "folder" | "collection" | null } {
  if (!workspace) {
    return { mode: "none", config: {}, source: "No workspace loaded", entityId: null, entityType: null };
  }

  if (request.authMode !== "none") {
    return { mode: request.authMode, config: request.authConfig, source: "Request level", entityId: request.id, entityType: "request" };
  }

  let currentFolderId: string | undefined = request.folderId;
  let resolvedCollectionId: string | undefined;

  while (currentFolderId) {
    const folder = workspace.folders.find((f) => f.id === currentFolderId);
    if (!folder) {
      if (!resolvedCollectionId && workspace.collections?.some(c => c.id === currentFolderId)) {
        resolvedCollectionId = currentFolderId;
      }
      break;
    }
    
    if (folder.authMode && folder.authMode !== "none") {
      return { mode: folder.authMode, config: folder.authConfig ?? {}, source: `Inherited from folder: ${folder.name}`, entityId: folder.id, entityType: "folder" };
    }
    
    if (!resolvedCollectionId && folder.collectionId) {
      resolvedCollectionId = folder.collectionId;
    }
    currentFolderId = folder.parentId;
  }

  if (resolvedCollectionId) {
    const collection = workspace.collections?.find((c) => c.id === resolvedCollectionId);
    if (collection?.authMode && collection.authMode !== "none") {
      return { mode: collection.authMode, config: collection.authConfig ?? {}, source: `Inherited from collection: ${collection.name}`, entityId: collection.id, entityType: "collection" };
    }
  }

  return { mode: "none", config: {}, source: "No inherited auth", entityId: null, entityType: null };
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
): Promise<{ token: string; refreshToken?: string; expiresAt?: number }> {
  const grantType = authConfig.grantType ?? "client_credentials";
  
  const url = tryResolve(authConfig.accessTokenUrl, variableMap);
  if (grantType !== "authorization_code" && !url) {
    throw new Error("Access Token URL is required");
  }
  const clientId = tryResolve(authConfig.clientId, variableMap);
  const clientSecret = tryResolve(authConfig.clientSecret, variableMap);
  const scope = tryResolve(authConfig.scope, variableMap);
  const audience = tryResolve(authConfig.audience, variableMap);

  const params = new URLSearchParams();
  const protocolGrantType = grantType === "password_credentials" ? "password" : grantType;
  params.append("grant_type", protocolGrantType);

  if (grantType === "password_credentials") {
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

        // Extract redirect_uri from the loginUrl to use in the exchange
        let redirectUri: string | undefined;
        try {
          const loginUrlObj = new URL(loginUrl);
          redirectUri = loginUrlObj.searchParams.get("redirect_uri") || undefined;
        } catch (e) {}

        // Open the browser window with the provided URL as-is
        await invoke("start_oauth_login", { loginUrl, redirectUri });
      } catch (err) {
        reject(err);
      }
    });
    
    if (unlistenCallback) unlistenCallback();
    if (unlistenToken) unlistenToken();
    
    // If no accessTokenUrl is configured to perform the exchange, return the code directly
    // (This acts as a fallback for Implicit Flow where the user manually captured the token).
    if (!url) {
      return { token: authCode }; 
    }
    
    // Otherwise, assume it's a code and we need to exchange it
    const exchangeParams = new URLSearchParams();
    exchangeParams.append("grant_type", "authorization_code");
    exchangeParams.append("code", authCode);
    
    // Extract redirect_uri from the loginUrl to use in the exchange
    try {
      const loginUrlObj = new URL(loginUrl);
      const redirectUri = loginUrlObj.searchParams.get("redirect_uri");
      if (redirectUri) {
        exchangeParams.append("redirect_uri", redirectUri);
      }
    } catch (e) {}

    const exchangeHeaders: Array<{ key: string; value: string; enabled: boolean }> = [
      { key: "Content-Type", value: "application/x-www-form-urlencoded", enabled: true }
    ];

    if (clientId && clientSecret) {
      try {
        const encoded = btoa(`${clientId}:${clientSecret}`);
        exchangeHeaders.push({ key: "Authorization", value: `Basic ${encoded}`, enabled: true });
      } catch (e) {
        exchangeParams.append("client_id", clientId);
        exchangeParams.append("client_secret", clientSecret);
      }
    } else if (clientId) {
      exchangeParams.append("client_id", clientId);
    }
    
    const exchangeResponse = await executeHttpRequest({
      method: "POST",
      url,
      headers: exchangeHeaders,
      body: exchangeParams.toString(),
      bodyMimeType: "application/x-www-form-urlencoded",
      timeoutMs: 30000,
      followRedirects: true,
    });
    
    if (exchangeResponse.status < 200 || exchangeResponse.status >= 300) {
      throw new Error(`Failed to exchange code for token (HTTP ${exchangeResponse.status}): ${exchangeResponse.bodyText || exchangeResponse.statusText}`);
    }
    
    const exchangeData = JSON.parse(exchangeResponse.bodyText || "{}");
    if (exchangeData.access_token || exchangeData.token) {
      const expiresIn = exchangeData.expires_in || exchangeData.expiresIn;
      return {
        token: exchangeData.access_token || exchangeData.token,
        refreshToken: exchangeData.refresh_token || exchangeData.refreshToken,
        expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
      };
    } else {
      throw new Error("Exchange response did not contain an access_token");
    }
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
  if (data.access_token || data.token) {
    const expiresIn = data.expires_in || data.expiresIn;
    return {
      token: data.access_token || data.token,
      refreshToken: data.refresh_token || data.refreshToken,
      expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
    };
  } else {
    throw new Error("Response did not contain an access_token");
  }
}

/**
 * Perform a POST request to refresh an Access Token via OAuth 2.0.
 */
export async function refreshOAuth2Token(
  authConfig: AuthConfig,
  variableMap: Map<string, string>,
): Promise<{ token: string; refreshToken?: string; expiresAt?: number }> {
  const url = tryResolve(authConfig.accessTokenUrl, variableMap);
  if (!url) throw new Error("Access Token URL is required to refresh token");
  if (!authConfig.refreshToken) throw new Error("No refresh token available");

  const clientId = tryResolve(authConfig.clientId, variableMap);
  const clientSecret = tryResolve(authConfig.clientSecret, variableMap);

  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", authConfig.refreshToken);

  const headers: Array<{ key: string; value: string; enabled: boolean }> = [
    { key: "Content-Type", value: "application/x-www-form-urlencoded", enabled: true }
  ];

  if (clientId && clientSecret) {
    try {
      const encoded = btoa(`${clientId}:${clientSecret}`);
      headers.push({ key: "Authorization", value: `Basic ${encoded}`, enabled: true });
    } catch (e) {
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
    throw new Error(`Failed to refresh token (HTTP ${response.status}): ${response.bodyText || response.statusText}`);
  }

  const data = JSON.parse(response.bodyText || "{}");
  if (data.access_token || data.token) {
    return {
      token: data.access_token || data.token,
      refreshToken: data.refresh_token || authConfig.refreshToken, // keep old if not returned
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    };
  } else {
    throw new Error("Refresh response did not contain an access_token");
  }
}

/**
 * Refreshes an expired OAuth 2.0 token using the refresh token, or automatically
 * falls back to obtaining a new token if the refresh fails or no refresh token is present.
 */
export async function refreshOrObtainOAuth2Token(
  authConfig: AuthConfig,
  variableMap: Map<string, string>,
): Promise<{ token: string; refreshToken?: string; expiresAt?: number; refreshed: boolean }> {
  if (authConfig.refreshToken) {
    try {
      const result = await refreshOAuth2Token(authConfig, variableMap);
      return { ...result, refreshed: true };
    } catch (refreshErr) {
      console.warn("[OAuth2] Refresh token failed or expired, falling back to obtain new token:", refreshErr);
      const result = await obtainOAuth2Token(authConfig, variableMap);
      return { ...result, refreshed: false };
    }
  }
  const result = await obtainOAuth2Token(authConfig, variableMap);
  return { ...result, refreshed: false };
}

