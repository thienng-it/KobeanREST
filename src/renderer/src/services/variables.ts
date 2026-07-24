import type { EnvironmentVariable, WorkspaceSummary } from "../types";

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

  if (scope.collectionId) {
    const collection = workspace.collections?.find((c) => c.id === scope.collectionId);
    ingest(collection?.variables);
  }

  if (scope.folderId) {
    const folder = workspace.folders.find((f) => f.id === scope.folderId);
    ingest(folder?.variables);
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
  return Array.from(map.entries()).map(([key, value]) => ({ key, value }));
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
  const resolvedUrl = resolveString(url, variableMap).resolved;

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
