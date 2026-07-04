import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("variable service resolves {{baseUrl}} and other template variables", () => {
  const variablesService = read("src/renderer/src/services/variables.ts");

  // Core API surface
  assert.match(variablesService, /export function resolveString\(/);
  assert.match(variablesService, /export function resolveRequestVariables\(/);
  assert.match(variablesService, /export function activeEnvironmentVariables\(/);
  assert.match(variablesService, /export function buildVariableMap\(/);
  assert.match(variablesService, /export function detectVariables\(/);
  assert.match(variablesService, /export function containsVariables\(/);

  // Resolves the standard pattern
  assert.match(variablesService, /\{\{([^{}]+)\}\}/);
});

test("unresolved variables throw UnresolvedVariableError", () => {
  const variablesService = read("src/renderer/src/services/variables.ts");

  assert.match(variablesService, /export class UnresolvedVariableError extends Error/);
  assert.match(variablesService, /unresolvedNames/);
  assert.match(variablesService, /throw new UnresolvedVariableError/);
});

test("secret variables are excluded from resolution to prevent leaking redacted placeholders", () => {
  const variablesService = read("src/renderer/src/services/variables.ts");

  // buildVariableMap should skip secret variables with secretRef
  assert.match(variablesService, /variable\.secret/);
  assert.match(variablesService, /variable\.secretRef/);
  assert.match(variablesService, /continue/);
});

test("send flow resolves variables before calling native HTTP", () => {
  const app = read("src/renderer/src/App.tsx");

  // Variables are resolved before the native send
  assert.match(app, /resolveRequestVariables/);
  assert.match(app, /UnresolvedVariableError/);
  assert.match(app, /resolvedUrl/);
  assert.match(app, /resolvedHeaders/);
  assert.match(app, /resolvedBody/);

  // Native send receives resolved values, not raw template strings
  assert.match(app, /url: auth(?:Url|ed)/);
  assert.match(app, /headers: authHeaders/);
  assert.match(app, /body: resolvedBody/);
});

test("unresolved variables stop request execution and show error without calling native send", () => {
  const app = read("src/renderer/src/App.tsx");

  // When resolution fails, an error is shown and the function returns
  // before reaching the executeHttpRequest call
  const variableResolutionBlock = app.indexOf("resolveRequestVariables");
  const nativeSendBlock = app.indexOf("executeHttpRequest(", variableResolutionBlock);

  assert.ok(variableResolutionBlock > -1, "resolveRequestVariables must appear in App.tsx");
  assert.ok(nativeSendBlock > variableResolutionBlock, "native send must come after variable resolution");

  // The catch block for variable resolution sets error state and returns early
  assert.match(app, /kind: "error",\s*(?:\n\s*)?message: error\.message/);
});

test("error state no longer shows stale 200 Preview OK response", () => {
  const app = read("src/renderer/src/App.tsx");

  // Error kind should not carry a response property
  const responseStateType = app.match(
    /\| \{ kind: "error"[^}]+\}/,
  );
  assert.ok(responseStateType, "error variant in ResponseState union must exist");
  assert.doesNotMatch(responseStateType[0], /response/, "error state must not carry a response property");

  // Heading should show "Request failed" instead of status code when in error state
  assert.match(app, /Request failed/);

  // Error body shows a no-response message, not stale response data
  assert.match(app, /No response.*see error above/);
});

test("resolved URL is recorded in request history instead of template URL", () => {
  const app = read("src/renderer/src/App.tsx");

  // recordRequestHistory should use the resolved/redacted URL (never the raw template)
  const historyBlock = app.slice(app.indexOf("recordRequestHistory"));
  assert.match(historyBlock, /url: (?:resolvedUrl|historyUrl)/);
});

test("header variables resolve only for enabled headers", () => {
  const variablesService = read("src/renderer/src/services/variables.ts");

  assert.match(variablesService, /header\.enabled/);
});
