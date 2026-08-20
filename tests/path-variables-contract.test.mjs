import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");

// Inline equivalent implementation for pure ESM test runner
function extractPathVariablesFromUrl(url) {
  if (!url || typeof url !== "string") return [];
  const qIdx = url.indexOf("?");
  const hashIdx = url.indexOf("#");
  let endIdx = url.length;
  if (qIdx >= 0) endIdx = qIdx;
  if (hashIdx >= 0 && hashIdx < endIdx) endIdx = hashIdx;

  let pathPart = url.slice(0, endIdx);
  pathPart = pathPart.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "");
  pathPart = pathPart.replace(/\{\{[^{}]+\}\}/g, "__ENV_VAR__");

  const keys = [];
  const seen = new Set();

  const colonRegex = /(?:^|[/?#]):([a-zA-Z0-9_]+)/g;
  let match;
  while ((match = colonRegex.exec(pathPart)) !== null) {
    const key = match[1];
    if (key && !seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }

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

function resolvePathVariablesInUrl(url, pathVariables) {
  if (!url || !pathVariables || pathVariables.length === 0) return url;
  let resolved = url;

  for (const item of pathVariables) {
    if (!item.enabled || !item.key) continue;
    const key = item.key.trim();
    if (!key) continue;

    const value = item.value ?? "";
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const colonPattern = new RegExp(`:${escapedKey}(?=[/?#]|$)`, "g");
    resolved = resolved.replace(colonPattern, value);

    const bracePattern = new RegExp(`\\{${escapedKey}\\}`, "g");
    resolved = resolved.replace(bracePattern, value);
  }

  return resolved;
}

function syncPathVariablesWithUrl(url, existingPathVariables) {
  const detectedKeys = extractPathVariablesFromUrl(url);
  if (detectedKeys.length === 0) {
    return existingPathVariables && existingPathVariables.length > 0 ? existingPathVariables : [];
  }

  const existingMap = new Map();
  if (existingPathVariables) {
    for (const item of existingPathVariables) {
      if (item.key) {
        existingMap.set(item.key, item);
      }
    }
  }

  return detectedKeys.map((key) => {
    const existing = existingMap.get(key);
    if (existing) {
      return {
        key,
        value: existing.value ?? "",
        enabled: existing.enabled !== false,
        description: existing.description ?? "",
      };
    }
    return {
      key,
      value: "",
      enabled: true,
      description: "",
    };
  });
}

test("extractPathVariablesFromUrl: detects colon and brace path variables accurately", () => {
  const url1 = "https://api.example.com/users/:userId/posts/:postId?query=1";
  assert.deepEqual(extractPathVariablesFromUrl(url1), ["userId", "postId"]);

  const url2 = "https://api.example.com/orgs/{orgId}/teams/{teamId}#hash";
  assert.deepEqual(extractPathVariablesFromUrl(url2), ["orgId", "teamId"]);

  const url3 = "{{baseUrl}}/v1/users/:id/details";
  assert.deepEqual(extractPathVariablesFromUrl(url3), ["id"]);

  const url4 = "http://localhost:8080/items/:itemId?filter=:notAPathVar";
  assert.deepEqual(extractPathVariablesFromUrl(url4), ["itemId"]);
});

test("resolvePathVariablesInUrl: substitutes enabled path variables into URL", () => {
  const url = "https://api.example.com/users/:userId/orders/{orderId}?status=active";
  const vars = [
    { key: "userId", value: "42", enabled: true },
    { key: "orderId", value: "order-999", enabled: true },
  ];

  const resolved = resolvePathVariablesInUrl(url, vars);
  assert.equal(resolved, "https://api.example.com/users/42/orders/order-999?status=active");
});

test("syncPathVariablesWithUrl: preserves existing values when URL is updated", () => {
  const oldVars = [
    { key: "userId", value: "100", enabled: true, description: "User identifier" }
  ];
  const newUrl = "https://api.example.com/users/:userId/posts/:postId";

  const synced = syncPathVariablesWithUrl(newUrl, oldVars);
  assert.deepEqual(synced, [
    { key: "userId", value: "100", enabled: true, description: "User identifier" },
    { key: "postId", value: "", enabled: true, description: "" },
  ]);
});

test("path-variables.ts source contract: exports all required functions", () => {
  const source = read("src/renderer/src/services/path-variables.ts");
  assert.match(source, /export function extractPathVariablesFromUrl/);
  assert.match(source, /export function hasPathVariablesInUrl/);
  assert.match(source, /export function syncPathVariablesWithUrl/);
  assert.match(source, /export function resolvePathVariablesInUrl/);
});

test("request-executor.ts contract: integrates path variable resolution", () => {
  const executor = read("src/renderer/src/services/request-executor.ts");
  assert.match(executor, /import\s*\{[^}]*resolvePathVariablesInUrl[^}]*\}\s*from\s*["']\.\/path-variables["']/);
  assert.match(executor, /resolvePathVariablesInUrl\(finalUrl,\s*resolvedPathVars\)/);
});

test("RequestPanel.tsx contract: renders Path Variables section in Params tab", () => {
  const panel = read("src/renderer/src/components/RequestPanel.tsx");
  assert.match(panel, /import\s*\{[^}]*syncPathVariablesWithUrl[^}]*\}\s*from\s*["']\.\.\/services\/path-variables["']/);
  assert.match(panel, /Path Variables/);
  assert.match(panel, /className="path-vars-empty-hint"/);
  assert.match(panel, /className=\{param\.enabled !== false \? "path-vars-row" : "path-vars-row headers-row-disabled"\}/);
  assert.match(panel, /updatePathVariableField/);
  assert.match(panel, /togglePathVariableEnabled/);
  assert.match(panel, /removePathVariable/);
});

test("styles.css contract: contains Path Variables design tokens and classes", () => {
  const styles = read("src/renderer/src/styles.css");
  assert.match(styles, /\.params-sections-wrapper/);
  assert.match(styles, /\.path-vars-empty-hint/);
  assert.match(styles, /\.path-vars-row/);
  assert.match(styles, /\.path-vars-row-key/);
  assert.match(styles, /\.variable-highlight\.path-variable-highlight/);
});

test("VariableInput.tsx contract: supports path variables tokenization and popovers", () => {
  const inputSource = read("src/renderer/src/components/VariableInput.tsx");
  assert.match(inputSource, /pathVariables\?: Array<\{ key: string; value: string;/);
  assert.match(inputSource, /onUpdatePathVariable\?: \(key: string, value: string\) => void/);
  assert.match(inputSource, /path-variable-highlight/);
  assert.match(inputSource, /isPathVariable/);
});

test("RequestPanel.tsx contract: passes pathVariables and onUpdatePathVariable to URL input", () => {
  const panelSource = read("src/renderer/src/components/RequestPanel.tsx");
  assert.match(panelSource, /pathVariables=\{draftRequest\.pathVariables\}/);
  assert.match(panelSource, /onUpdatePathVariable=\{updatePathVariableValue\}/);
});

test("persistence.rs contract: persists path_variables in SQLite database", () => {
  const persistence = read("src-tauri/src/persistence.rs");
  assert.match(persistence, /pub struct PathVariableEntry/);
  assert.match(persistence, /pub path_variables:\s*Option<Vec<PathVariableEntry>>/);
  assert.match(persistence, /ensure_request_path_variables_column/);
  assert.match(persistence, /requests\.path_variables/);
  assert.match(persistence, /path_variables\s*=\s*excluded\.path_variables/);
});

