import type { EnvironmentVariable, WorkspaceSummary } from "../types";
import jq from "jq-web";
import { loadHistory, loadHistoryResponse } from "./local-store";

const VARIABLE_PATTERN = /\{\{([^{}]+)\}\}/g;

export interface VariableResolutionResult {
  resolved: string;
  usedVariables: string[];
}

export class UnresolvedVariableError extends Error {
  public readonly unresolvedNames: string[];

  constructor(unresolvedNames: string[]) {
    super(`Unresolved variable${unresolvedNames.length > 1 ? "s" : ""}: ${unresolvedNames.join(", ")}`);
    this.name = "UnresolvedVariableError";
    this.unresolvedNames = unresolvedNames;
  }
}

/**
 * Built-in dynamic variables (Postman-style `$`-prefixed helpers).
 * These are generated on demand rather than stored in the environment,
 * so `{{$guid}}` / `{{$timestamp}}` resolve without being predefined.
 * An env variable of the same name always takes precedence.
 */
const DYNAMIC_VARIABLES: Record<string, () => string> = {
  $guid: () => randomUuid(),
  $randomUUID: () => randomUuid(),
  $timestamp: () => String(Math.floor(Date.now() / 1000)),
  $timestampMs: () => String(Date.now()),
  $isoTimestamp: () => new Date().toISOString(),
  $isoDatetime: () => new Date().toISOString(),
  $datetime: () => new Date().toISOString(),
  $date: () => new Date().toISOString().slice(0, 10),
  $randomInt: () => String(Math.floor(Math.random() * 1000)),
  $randomString: () => randomString(8),
};

function randomUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // ponytail: fallback only — crypto.randomUUID is available in Tauri/browser.
  return randomString(8) + "-" + randomString(4) + "-4" + randomString(3) + "-a" + randomString(3) + "-" + randomString(12);
}

function randomString(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/**
 * Find the active environment variables from the workspace.
 * Returns an empty array if the active environment does not exist or workspace is null.
 */
export function activeEnvironmentVariables(workspace: WorkspaceSummary | null): EnvironmentVariable[] {
  if (!workspace) return [];
  if (!workspace.activeEnvironment) return [];
  const environment = workspace.environments.find(
    (env) => env.name === workspace.activeEnvironment,
  );
  return environment?.variables ?? [];
}

export function buildVariableMap(
  variables: EnvironmentVariable[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const variable of variables) {
    if (variable.secret || variable.secretRef) continue;
    map.set(variable.key, variable.value);
  }
  return map;
}

export function buildScopedVariableMap(
  workspace: WorkspaceSummary,
  scope: { collectionId?: string; folderId?: string; requestId?: string; request?: import("../types").SavedRequest },
): Map<string, string> {
  const map = new Map<string, string>();

  const ingest = (vars: { key: string; value: string }[] | undefined) => {
    if (!vars) return;
    for (const v of vars) {
      map.set(v.key, v.value);
    }
  };

  // Active environment first (lowest precedence).
  ingest(activeEnvironmentVariables(workspace));

  let resolvedFolderId = scope.folderId;
  if (!resolvedFolderId) {
    if (scope.request) resolvedFolderId = scope.request.folderId;
    else if (scope.requestId) {
      const r = workspace.requests.find(req => req.id === scope.requestId);
      if (r) resolvedFolderId = r.folderId;
    }
  }

  let resolvedCollectionId = scope.collectionId;
  const folders: import("../types").FolderSummary[] = [];

  if (resolvedFolderId) {
    let currentFolderId: string | undefined = resolvedFolderId;
    while (currentFolderId) {
      const folder = workspace.folders.find((f) => f.id === currentFolderId);
      if (folder) {
        folders.push(folder);
        if (!resolvedCollectionId && folder.collectionId) {
          resolvedCollectionId = folder.collectionId;
        }
        currentFolderId = folder.parentId;
      } else {
        if (!resolvedCollectionId && workspace.collections?.some(c => c.id === currentFolderId)) {
          resolvedCollectionId = currentFolderId;
        }
        break;
      }
    }
  }

  if (resolvedCollectionId) {
    const collection = workspace.collections?.find((c) => c.id === resolvedCollectionId);
    ingest(collection?.variables);
  }

  // Ingest from top-level down to the immediate folder.
  for (let i = folders.length - 1; i >= 0; i--) {
    ingest(folders[i].variables);
  }

  if (scope.request) {
    ingest(scope.request.variables);
  } else if (scope.requestId) {
    const request = workspace.requests.find((r) => r.id === scope.requestId);
    ingest(request?.variables);
  }

  return map;
}

export function activeScopedVariablesList(
  workspace: WorkspaceSummary | null,
  scope: { collectionId?: string; folderId?: string; requestId?: string; request?: import("../types").SavedRequest },
): EnvironmentVariable[] {
  if (!workspace) return [];
  const map = buildScopedVariableMap(workspace, scope);
  const vars = Array.from(map.entries()).map(([key, value]) => ({ key, value, secret: false }));

  for (const key of Object.keys(DYNAMIC_VARIABLES)) {
    vars.push({ key, value: "(Dynamic Generator)", secret: false });
  }
  vars.push({ key: '$response "Request Name" $.', value: "(Extract from response)", secret: false });

  return vars;
}

/**
 * Detect all `{{variableName}}` references in a string.
 */
export function detectVariables(text: string): string[] {
  const names: string[] = [];
  let match: RegExpExecArray | null;
  const pattern = new RegExp(VARIABLE_PATTERN.source, "g");
  while ((match = pattern.exec(text)) !== null) {
    const name = match[1].trim();
    if (name && !names.includes(name)) {
      names.push(name);
    }
  }
  return names;
}

/**
 * Replace all `{{variableName}}` references in a string using
 * the provided variable map. Returns the resolved string and the
 * list of variable keys that were substituted.
 *
 * Throws `UnresolvedVariableError` if any variables remain after substitution.
 */
export function resolveString(
  text: string,
  variableMap: Map<string, string>,
): VariableResolutionResult {
  const usedVariables: string[] = [];

  const resolved = text.replace(VARIABLE_PATTERN, (fullMatch, rawName: string) => {
    const name = rawName.trim();
    if (variableMap.has(name)) {
      if (!usedVariables.includes(name)) {
        usedVariables.push(name);
      }
      return variableMap.get(name)!;
    }
    for (const [key, val] of variableMap.entries()) {
      if (key.toLowerCase() === name.toLowerCase()) {
        if (!usedVariables.includes(key)) {
          usedVariables.push(key);
        }
        return val;
      }
    }
    // Built-in dynamic helpers ({{$guid}}, {{$timestamp}}, ...) resolve on demand
    // so users don't have to define them in the environment.
    const generator = DYNAMIC_VARIABLES[name];
    if (generator) {
      if (!usedVariables.includes(name)) {
        usedVariables.push(name);
      }
      return generator();
    }
    return fullMatch;
  });

  // Check for any remaining unresolved variables
  const remaining = detectVariables(resolved);
  if (remaining.length > 0) {
    throw new UnresolvedVariableError(remaining);
  }

  return { resolved, usedVariables };
}

/**
 * Replace all `{{variableName}}` references in a string using
 * the provided variable map. Returns the resolved string.
 *
 * Does not throw if variables remain unresolved.
 */
export function resolveStringSafe(
  text: string,
  variableMap: Map<string, string>,
): string {
  return text.replace(VARIABLE_PATTERN, (fullMatch, rawName: string) => {
    const name = rawName.trim();
    if (variableMap.has(name)) {
      return variableMap.get(name)!;
    }
    for (const [key, val] of variableMap.entries()) {
      if (key.toLowerCase() === name.toLowerCase()) {
        return val;
      }
    }
    const generator = DYNAMIC_VARIABLES[name];
    if (generator) {
      return generator();
    }
    return fullMatch;
  });
}

/**
 * Check whether a string contains any `{{...}}` variable references.
 */
export function containsVariables(text: string): boolean {
  return VARIABLE_PATTERN.test(text);
}

export interface ResolvedRequestFields {
  url: string;
  headers: Array<{ key: string; value: string; enabled: boolean }>;
  body?: string;
}

/**
 * Returns true if a string segment is already percent-encoded.
 * Only %XX sequences (not bare '+') are treated as encoding evidence.
 * Round-trip: decode → re-encode must reproduce the original string exactly.
 */
function isAlreadyEncoded(segment: string): boolean {
  // Fast-path: no %XX means definitely not encoded.
  if (!/%[0-9A-Fa-f]{2}/.test(segment)) {
    return false;
  }
  try {
    const decoded = decodeURIComponent(segment);
    return encodeURIComponent(decoded) === segment;
  } catch {
    // decodeURIComponent throws on malformed sequences (e.g. "100%") → not encoded.
    return false;
  }
}

function encodeIfNeeded(segment: string): string {
  return isAlreadyEncoded(segment) ? segment : encodeURIComponent(segment);
}

/**
 * After variable substitution, query param values injected from environment
 * variables (e.g. "hello+123@hello.com") may contain characters that must be
 * percent-encoded in a URL. This function parses the query string of a fully-
 * resolved URL and re-encodes each key/value pair that is not already encoded,
 * preventing double-encoding of values that were already percent-encoded.
 */
export function encodeQueryParamsInResolvedUrl(url: string): string {
  const qIndex = url.indexOf('?');
  if (qIndex === -1) return url;

  const base = url.slice(0, qIndex);
  const queryString = url.slice(qIndex + 1);
  if (!queryString) return url;

  const encoded = queryString
    .split('&')
    .map((pair) => {
      if (!pair) return pair;
      const eqIdx = pair.indexOf('=');
      if (eqIdx < 0) return encodeIfNeeded(pair);
      const k = pair.slice(0, eqIdx);
      const v = pair.slice(eqIdx + 1);
      return `${encodeIfNeeded(k)}=${encodeIfNeeded(v)}`;
    })
    .join('&');

  return `${base}?${encoded}`;
}

/**
 * Resolve all variables in the URL, headers, and body of a request
 * using a pre-built variable map (typically from `buildScopedVariableMap` +
 * `injectResolvedSecrets`). Throws `UnresolvedVariableError` if any variable
 * references remain after resolution.
 */
export function resolveRequestFields(
  variableMap: Map<string, string>,
  url: string,
  headers: Array<{ key: string; value: string; enabled: boolean }>,
  body: string | undefined,
): ResolvedRequestFields {
  let resolvedUrl = resolveString(url, variableMap).resolved;
  resolvedUrl = resolvedUrl.replace(/^https?:\/\/(https?:\/\/)/i, '$1');
  resolvedUrl = encodeQueryParamsInResolvedUrl(resolvedUrl);

  const resolvedHeaders = headers.map((header) => ({
    key: header.key,
    value: header.enabled ? resolveString(header.value, variableMap).resolved : header.value,
    enabled: header.enabled,
  }));

  let resolvedBody = body;
  if (body && body.trim().length > 0) {
    resolvedBody = resolveString(body, variableMap).resolved;
  }

  return {
    url: resolvedUrl,
    headers: resolvedHeaders,
    body: resolvedBody,
  };
}

/**
 * Resolve all variables in the URL, headers, and body of a request
 * safely (does not throw if variables are unresolved).
 */
export function resolveRequestFieldsSafe(
  variableMap: Map<string, string>,
  url: string,
  headers: Array<{ key: string; value: string; enabled: boolean }>,
  body: string | undefined,
): ResolvedRequestFields {
  let resolvedUrl = resolveStringSafe(url, variableMap);
  resolvedUrl = resolvedUrl.replace(/^https?:\/\/(https?:\/\/)/i, '$1');
  resolvedUrl = encodeQueryParamsInResolvedUrl(resolvedUrl);

  const resolvedHeaders = headers.map((header) => ({
    key: header.key,
    value: header.enabled ? resolveStringSafe(header.value, variableMap) : header.value,
    enabled: header.enabled,
  }));

  let resolvedBody = body;
  if (body && body.trim().length > 0) {
    resolvedBody = resolveStringSafe(body, variableMap);
  }

  return {
    url: resolvedUrl,
    headers: resolvedHeaders,
    body: resolvedBody,
  };
}

/**
 * Resolve all variables in the URL, headers, and body of a request.
 * Throws `UnresolvedVariableError` if any variable references remain
 * after resolution.
 */
export function resolveRequestVariables(
  url: string,
  headers: Array<{ key: string; value: string; enabled: boolean }>,
  body: string | undefined,
  workspace: WorkspaceSummary,
): ResolvedRequestFields {
  const variables = activeEnvironmentVariables(workspace);
  const variableMap = buildVariableMap(variables);
  return resolveRequestFields(variableMap, url, headers, body);
}

/**
 * Scan texts for async variables (e.g., {{$response "req name" $.token}})
 * and resolve them by fetching history data, placing the result in variableMap.
 * 
 * @param inMemoryResponses - Optional map of request ID/name to response for the current run (takes precedence over database history)
 */
export async function injectAsyncVariables(
  variableMap: Map<string, string>,
  texts: (string | undefined)[],
  workspace: WorkspaceSummary,
  inMemoryResponses?: Map<string, import("../types").ExecuteHttpResponse>
): Promise<void> {
  for (const text of texts) {
    if (!text) continue;
    const names = detectVariables(text);
    for (const name of names) {
      if (variableMap.has(name)) continue;

      const match = name.match(/^\$response\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))\s+(.+)$/);
      if (match) {
        const requestRef = match[1] || match[2] || match[3];
        const jqPath = match[4];

        const targetRequest = workspace.requests.find(r => r.id === requestRef || r.name === requestRef);
        if (!targetRequest) {
          console.warn(`$response: Could not find request "${requestRef}"`);
          continue;
        }

        try {
          let responseBody: string | undefined;
          
          // First, check in-memory responses from current run
          if (inMemoryResponses) {
            const inMemoryResponse = inMemoryResponses.get(targetRequest.id) || inMemoryResponses.get(targetRequest.name);
            if (inMemoryResponse?.bodyText) {
              console.log(`$response: Found in-memory response for "${requestRef}"`);
              responseBody = inMemoryResponse.bodyText;
            } else {
              console.log(`$response: No in-memory response for "${requestRef}" (id: ${targetRequest.id}, name: ${targetRequest.name}). Map has ${inMemoryResponses.size} entries.`);
            }
          }
          
          // Fall back to database history if not found in memory
          if (!responseBody) {
            console.log(`$response: Checking database history for "${requestRef}"`);
            const history = await loadHistory();
            const entries = history.filter(h => h.requestId === targetRequest.id).sort((a,b) => b.id - a.id);
            
            if (entries.length > 0) {
              const payload = await loadHistoryResponse(entries[0].id);
              if (payload && payload.responseBodyText) {
                console.log(`$response: Found in database history for "${requestRef}"`);
                responseBody = payload.responseBodyText;
              }
            } else {
              console.warn(`$response: No history found for "${requestRef}"`);
            }
          }
          
          if (responseBody) {
            const data = JSON.parse(responseBody);
            const j = await jq;
            
            // support JSONPath-like prefix for ergonomics
            let filter = jqPath;
            if (filter.startsWith("$.")) {
              filter = filter.substring(1);
            }
            
            const result = j.json(data, filter);
            let val = "";
            if (typeof result === "string") val = result;
            else if (result !== null && result !== undefined) val = JSON.stringify(result);
            // For jq returning single elements or arrays
            if (Array.isArray(result) && result.length === 1 && typeof result[0] === "string") {
                val = result[0];
            } else if (Array.isArray(result) && result.length === 1 && typeof result[0] !== "object") {
                val = String(result[0]);
            }
            variableMap.set(name, val);
          }
        } catch (e) {
          console.error("Failed to evaluate $response variable:", name, e);
        }
      }
    }
  }
}
