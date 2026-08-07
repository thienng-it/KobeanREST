import type { SavedRequest, WorkspaceSummary, ExecuteHttpRequest } from "../types";
import { resolveRequestFields, injectAsyncVariables } from "./variables";
import { getEffectiveAuth, applyAuth, resolveAuthConfig, redactAuthFromUrl, obtainOAuth2Token } from "./auth";

export async function prepareRequestForExecution(
  requestToSend: SavedRequest,
  workspace: WorkspaceSummary,
  variableMap: Map<string, string>,
  inMemoryResponses?: Map<string, import("../types").ExecuteHttpResponse>
): Promise<{ request: ExecuteHttpRequest, obtainedToken?: string, historyUrl: string }> {
  let authToScan = requestToSend.authConfig;
  if (requestToSend.authMode === "none") {
    const inherited = getEffectiveAuth(requestToSend, workspace);
    if (inherited.mode !== "none") {
      authToScan = inherited.config;
    }
  }

  const textsToScan = [
    requestToSend.url, 
    requestToSend.body || "", 
    ...requestToSend.headers.map((h: any) => h.value),
    authToScan?.token, authToScan?.username, authToScan?.password,
    authToScan?.keyValue, authToScan?.clientId, authToScan?.clientSecret,
    authToScan?.accessTokenUrl, authToScan?.scope, authToScan?.audience,
  ];
  
  await injectAsyncVariables(variableMap, textsToScan, workspace, inMemoryResponses);

  const resolved = resolveRequestFields(variableMap, requestToSend.url, requestToSend.headers, requestToSend.body || undefined);
  
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
  let obtainedToken: string | undefined = undefined;
  
  if (finalAuthMode === "oauth2" && !resolvedAuth.token) {
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: "Obtaining OAuth 2.0 token...", tone: "info" } }));
    try {
      obtainedToken = await obtainOAuth2Token(resolvedAuth, variableMap);
      resolvedAuth.token = obtainedToken;
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: "Access token obtained successfully!", tone: "success" } }));
    } catch (e: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: "Failed to obtain OAuth 2.0 token: " + e.message, tone: "error" } }));
      throw e;
    }
  }

  const { url: authUrl, headers: authHeaders } = applyAuth(finalAuthMode, resolvedAuth, resolved.url, resolved.headers);
  
  const historyUrl = redactAuthFromUrl(authUrl, finalAuthMode, resolvedAuth);
  
  const effectiveMethod = requestToSend.method === "CUSTOM" ? (requestToSend.customMethod?.trim().toUpperCase() || "CUSTOM") : requestToSend.method;

  return {
    request: {
      method: effectiveMethod,
      url: authUrl,
      headers: authHeaders,
      body: resolved.body,
      bodyMimeType: requestToSend.bodyMimeType,
      bodyForm: requestToSend.bodyForm,
      timeoutMs: requestToSend.timeoutMs,
      followRedirects: requestToSend.followRedirects,
    },
    obtainedToken,
    historyUrl
  };
}
