import type { SavedRequest, WorkspaceSummary, ExecuteHttpRequest } from "../types";
import { resolveRequestFields, injectAsyncVariables, resolveStringSafe } from "./variables";
import { getEffectiveAuth, applyAuth, resolveAuthConfig, redactAuthFromUrl, obtainOAuth2Token, refreshOAuth2Token } from "./auth";
import { resolvePathVariablesInUrl } from "./path-variables";

export async function prepareRequestForExecution(
  requestToSend: SavedRequest,
  workspace: WorkspaceSummary,
  variableMap: Map<string, string>,
  inMemoryResponses?: Map<string, import("../types").ExecuteHttpResponse>,
  executeUpstream?: (reqId: string) => Promise<import("../types").ExecuteHttpResponse | undefined>
): Promise<{ request: ExecuteHttpRequest, updatedAuth?: Partial<import("../types").AuthConfig>, updatedAuthEntityId?: string, updatedAuthEntityType?: "request" | "folder" | "collection", historyUrl: string }> {
  let authToScan = requestToSend.authConfig;
  let authEntityId: string | null = requestToSend.id;
  let authEntityType: "request" | "folder" | "collection" | null = "request";
  
  if (requestToSend.authMode === "none") {
    const inherited = getEffectiveAuth(requestToSend, workspace);
    if (inherited.mode !== "none") {
      authToScan = inherited.config;
      authEntityId = inherited.entityId;
      authEntityType = inherited.entityType;
    }
  }

  const textsToScan = [
    requestToSend.url, 
    requestToSend.body || "", 
    ...requestToSend.headers.map((h: any) => h.value),
    ...(requestToSend.pathVariables || []).map((p: any) => p.value),
    authToScan?.token, authToScan?.username, authToScan?.password,
    authToScan?.keyValue, authToScan?.clientId, authToScan?.clientSecret,
    authToScan?.accessTokenUrl, authToScan?.scope, authToScan?.audience,
  ];
  
  await injectAsyncVariables(variableMap, textsToScan, workspace, inMemoryResponses, executeUpstream);

  const resolved = resolveRequestFields(variableMap, requestToSend.url, requestToSend.headers, requestToSend.body || undefined);

  let finalUrl = resolved.url;
  if (requestToSend.pathVariables && requestToSend.pathVariables.length > 0) {
    const resolvedPathVars = requestToSend.pathVariables.map((p) => ({
      ...p,
      value: p.enabled ? resolveStringSafe(p.value, variableMap) : p.value,
    }));
    finalUrl = resolvePathVariablesInUrl(finalUrl, resolvedPathVars);
  }
  
  let finalAuthMode = requestToSend.authMode;
  let finalAuthConfig = requestToSend.authConfig;
  const hasManualAuthHeader = resolved.headers.some(h => h.key.toLowerCase() === 'authorization' && h.enabled);

  if (finalAuthMode === "none" && !hasManualAuthHeader) {
    const inherited = getEffectiveAuth(requestToSend, workspace);
    if (inherited.mode !== "none") {
      finalAuthMode = inherited.mode;
      finalAuthConfig = inherited.config;
    }
  }

  const resolvedAuth = resolveAuthConfig(finalAuthConfig ?? {}, variableMap);
  let updatedAuth: Partial<import("../types").AuthConfig> | undefined = undefined;
  
  let needsToken = false;
  let shouldRefresh = false;

  if (finalAuthMode === "oauth2") {
    if (!resolvedAuth.token) {
      needsToken = true;
    } else if (resolvedAuth.expiresAt && Date.now() > resolvedAuth.expiresAt) {
      needsToken = true;
      if (resolvedAuth.refreshToken) {
        shouldRefresh = true;
      }
    }
  }

  if (needsToken) {
    if (shouldRefresh) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: "Refreshing OAuth 2.0 token...", tone: "info" } }));
      try {
        const result = await refreshOAuth2Token(resolvedAuth, variableMap);
        updatedAuth = { 
          token: result.token, 
          refreshToken: result.refreshToken || resolvedAuth.refreshToken, 
          expiresAt: result.expiresAt 
        };
        resolvedAuth.token = result.token;
        if (result.refreshToken) resolvedAuth.refreshToken = result.refreshToken;
        if (result.expiresAt) resolvedAuth.expiresAt = result.expiresAt;
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: "Access token refreshed successfully!", tone: "success" } }));
      } catch (e: any) {
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: "Failed to refresh OAuth 2.0 token: " + e.message + ". Attempting to obtain new one...", tone: "warning" } }));
        shouldRefresh = false; // Fall back to obtain new
      }
    }
    
    if (!shouldRefresh) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: "Obtaining OAuth 2.0 token...", tone: "info" } }));
      try {
        const result = await obtainOAuth2Token(resolvedAuth, variableMap);
        updatedAuth = { 
          token: result.token, 
          refreshToken: result.refreshToken || resolvedAuth.refreshToken, 
          expiresAt: result.expiresAt 
        };
        resolvedAuth.token = result.token;
        if (result.refreshToken) resolvedAuth.refreshToken = result.refreshToken;
        if (result.expiresAt) resolvedAuth.expiresAt = result.expiresAt;
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: "Access token obtained successfully!", tone: "success" } }));
      } catch (e: any) {
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: "Failed to obtain OAuth 2.0 token: " + e.message, tone: "error" } }));
        throw e;
      }
    }
  }

  const { url: authUrl, headers: authHeaders } = applyAuth(finalAuthMode, resolvedAuth, finalUrl, resolved.headers);
  
  const historyUrl = redactAuthFromUrl(authUrl, finalAuthMode, resolvedAuth);
  
  const effectiveMethod = requestToSend.method === "CUSTOM" ? (requestToSend.customMethod?.trim().toUpperCase() || "CUSTOM") : requestToSend.method;

  let finalBody = resolved.body;
  let finalMimeType = requestToSend.bodyMimeType;
  let finalHeaders = [...authHeaders];

  if (requestToSend.bodyMimeType === "application/graphql") {
    finalMimeType = "application/json";
    if (!finalHeaders.some(h => h.key.toLowerCase() === 'content-type' && h.enabled)) {
      finalHeaders.push({ key: "Content-Type", value: "application/json", enabled: true });
    }
    if (resolved.body) {
      try {
        const parsed = JSON.parse(resolved.body);
        if (parsed && typeof parsed === "object" && ("query" in parsed || "variables" in parsed)) {
          let vars = parsed.variables;
          if (typeof vars === "string" && vars.trim()) {
            try {
              vars = JSON.parse(vars);
            } catch {
              // keep as string
            }
          }
          const payload: any = { query: parsed.query || "" };
          if (vars !== undefined && vars !== null && vars !== "") {
            payload.variables = vars;
          }
          if (parsed.operationName) {
            payload.operationName = parsed.operationName;
          }
          finalBody = JSON.stringify(payload, null, 2);
        } else {
          finalBody = JSON.stringify({ query: resolved.body }, null, 2);
        }
      } catch {
        finalBody = JSON.stringify({ query: resolved.body }, null, 2);
      }
    }
  }

  return {
    request: {
      method: effectiveMethod,
      url: authUrl,
      headers: finalHeaders,
      body: finalBody,
      bodyMimeType: finalMimeType,
      bodyForm: requestToSend.bodyForm,
      timeoutMs: requestToSend.timeoutMs,
      followRedirects: requestToSend.followRedirects,
    },
    updatedAuth,
    updatedAuthEntityId: authEntityId || undefined,
    updatedAuthEntityType: authEntityType || undefined,
    historyUrl
  };
}
