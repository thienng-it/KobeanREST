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
 * Find the active environment variables from the workspace.
 * Returns an empty array if the active environment does not exist or workspace is null.
 */
export function activeEnvironmentVariables(workspace: WorkspaceSummary | null): EnvironmentVariable[] {
  if (!workspace) return [];
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
