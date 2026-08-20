export interface PathVariableItem {
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

/**
 * Extracts path variable keys from a URL string.
 * Supports Postman-style `:varName` (e.g. `/users/:userId`)
 * and OpenAPI-style `{varName}` (e.g. `/users/{userId}`).
 * Ignores protocol colons (`https://`), query parameters (`?foo=bar`),
 * and double-curly environment variable expressions (`{{baseUrl}}`).
 */
export function extractPathVariablesFromUrl(url: string): string[] {
  if (!url || typeof url !== "string") return [];

  // Strip query string and fragment
  const qIdx = url.indexOf("?");
  const hashIdx = url.indexOf("#");
  let endIdx = url.length;
  if (qIdx >= 0) endIdx = qIdx;
  if (hashIdx >= 0 && hashIdx < endIdx) endIdx = hashIdx;

  let pathPart = url.slice(0, endIdx);

  // Strip protocol prefix (e.g. https://, http://, ws://, wss://)
  pathPart = pathPart.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "");

  // Temporarily mask double-curly environment variables {{...}} so they are not treated as single braces
  pathPart = pathPart.replace(/\{\{[^{}]+\}\}/g, "__ENV_VAR__");

  const keys: string[] = [];
  const seen = new Set<string>();

  // 1. Match colon path variables: e.g. /:userId, /users/:id, :userId/something
  // Matches :identifier where identifier is [a-zA-Z0-9_]+
  const colonRegex = /(?:^|[/?#]):([a-zA-Z0-9_]+)/g;
  let match: RegExpExecArray | null;
  while ((match = colonRegex.exec(pathPart)) !== null) {
    const key = match[1];
    if (key && !seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }

  // 2. Match single curly brace path variables: e.g. /{userId}, /users/{id}
  const braceRegex = /\{([a-zA-Z0-9_]+)\}/g;
  while ((match = braceRegex.exec(pathPart)) !== null) {
    const key = match[1];
    if (key && key !== "__ENV_VAR__" && !seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }

  return keys;
}

/**
 * Returns true if the URL contains at least one path variable.
 */
export function hasPathVariablesInUrl(url: string): boolean {
  return extractPathVariablesFromUrl(url).length > 0;
}

/**
 * Synchronizes the list of Path Variables with the detected variables in the URL.
 * Preserves values, descriptions, and enabled states of existing items.
 */
export function syncPathVariablesWithUrl(
  url: string,
  existingPathVariables?: PathVariableItem[]
): PathVariableItem[] {
  const detectedKeys = extractPathVariablesFromUrl(url);
  if (detectedKeys.length === 0) {
    return existingPathVariables && existingPathVariables.length > 0 ? existingPathVariables : [];
  }

  const existingMap = new Map<string, PathVariableItem>();
  if (existingPathVariables) {
    for (const item of existingPathVariables) {
      if (item.key) {
        const clean = item.key.replace(/^:/, "");
        existingMap.set(clean, item);
        existingMap.set(item.key, item);
      }
    }
  }

  return detectedKeys.map((key) => {
    const cleanKey = key.replace(/^:/, "");
    const existing = existingMap.get(cleanKey) || existingMap.get(key) || existingMap.get(`:${cleanKey}`);
    if (existing) {
      return {
        key: cleanKey,
        value: existing.value ?? "",
        enabled: existing.enabled !== false,
        description: existing.description ?? "",
      };
    }
    return {
      key: cleanKey,
      value: "",
      enabled: true,
      description: "",
    };
  });
}

/**
 * Substitutes enabled path variables into the URL string.
 * Replaces both `:key` and `{key}` instances in the path portion.
 */
export function resolvePathVariablesInUrl(
  url: string,
  pathVariables?: PathVariableItem[]
): string {
  if (!url || !pathVariables || pathVariables.length === 0) return url;

  let resolved = url;

  for (const item of pathVariables) {
    if (!item.enabled || !item.key) continue;
    const key = item.key.trim();
    if (!key) continue;

    const value = item.value ?? "";

    // Escape regex special chars in key
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Replace :key (followed by / ? # or end of string)
    const colonPattern = new RegExp(`:${escapedKey}(?=[/?#]|$)`, "g");
    resolved = resolved.replace(colonPattern, value);

    // Replace {key} (single brace)
    const bracePattern = new RegExp(`\\{${escapedKey}\\}`, "g");
    resolved = resolved.replace(bracePattern, value);
  }

  return resolved;
}
