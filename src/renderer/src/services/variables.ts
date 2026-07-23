import type { EnvironmentVariable, WorkspaceSummary } from "../types";
import { resolveSecrets } from "./local-store";

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

/**
 * Build a lookup map from the active environment variables.
 * Secret variables with a `secretRef` but a redacted display value
 * are excluded from resolution to prevent leaking placeholders.
 */
export function buildVariableMap(
  variables: EnvironmentVariable[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const variable of variables) {
    if (variable.secret && variable.secretRef) {
      // Secret variables store only a redacted placeholder in SQLite.
      // They must not be injected into requests as raw text.
      continue;
    }
    map.set(variable.key, variable.value);
  }
  return map;
}

/**
 * Merge scope chain for a single request. Lower scopes override higher:
 * environment → collection → folder → request (last write wins).
 * Returns the plaintext map (non-secret values) plus the set of secret refs
 * that still need keychain resolution.
 */
export function buildScopedVariableMap(
  workspace: WorkspaceSummary,
  scope: { collectionId?: string; folderId?: string; requestId?: string },
): { map: Map<string, string>; secretRefs: Map<string, string> } {
  const map = new Map<string, string>();
  const secretRefs = new Map<string, string>();

  const ingest = (vars: { key: string; value: string; secret?: boolean; secretRef?: string }[] | undefined) => {
    if (!vars) return;
    for (const v of vars) {
      if (v.secret && v.secretRef) {
        // Hold the ref; the plaintext value is fetched from the keychain at send time.
        secretRefs.set(v.key, v.secretRef);
        map.delete(v.key);
      } else {
        map.set(v.key, v.value);
        secretRefs.delete(v.key);
      }
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

  if (scope.requestId) {
    const request = workspace.requests.find((r) => r.id === scope.requestId);
    ingest(request?.variables);
  }

  return { map, secretRefs };
}

/**
 * Fetch secret values from the keychain (single batched call) and fold them
 * into the variable map. Missing secrets resolve to an empty string and are
 * logged — non-blocking, matches the offline-friendly philosophy.
 */
export async function injectResolvedSecrets(
  map: Map<string, string>,
  secretRefs: Map<string, string>,
): Promise<Map<string, string>> {
  if (secretRefs.size === 0) return map;
  const refIds = Array.from(secretRefs.values());
  let resolved: Record<string, string> = {};
  try {
    resolved = await resolveSecrets(refIds);
  } catch (error) {
    console.error("Failed to resolve secrets", error);
    return map;
  }
  for (const [key, refId] of secretRefs) {
    map.set(key, resolved[refId] ?? "");
  }
  return map;
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
