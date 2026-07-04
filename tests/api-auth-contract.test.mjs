import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const hasFile = (path) => existsSync(new URL(path, root));

test("auth service exists and exports injection and redaction helpers", () => {
  assert.equal(hasFile("src/renderer/src/services/auth.ts"), true);

  const auth = read("src/renderer/src/services/auth.ts");
  assert.match(auth, /export function applyAuth/);
  assert.match(auth, /export function resolveAuthConfig/);
  assert.match(auth, /export function redactAuthFromUrl/);
  assert.match(auth, /export function redactAuthHeaders/);
});

test("applyAuth injects correct headers for each mode", () => {
  const auth = read("src/renderer/src/services/auth.ts");

  // Basic: builds Authorization: Basic ...
  assert.match(auth, /btoa/);
  assert.match(auth, /Basic \$\{/);

  // Bearer / oauth2: Authorization: Bearer ...
  assert.match(auth, /Bearer \$\{/);

  // apiKey header: pushes { key: keyName, value: keyValue }
  assert.match(auth, /keyName.*keyValue/s);

  // apiKey query: appends to URL
  assert.match(auth, /encodeURIComponent/);
  assert.match(auth, /placement.*query/s);
});

test("auth values are resolved through variable map before injection", () => {
  const auth = read("src/renderer/src/services/auth.ts");

  // Uses resolveString from variables service
  assert.match(auth, /from "\.\/variables"/);
  assert.match(auth, /resolveString/);
  assert.match(auth, /containsVariables/);
});

test("auth query params are redacted from URL before history recording", () => {
  const auth = read("src/renderer/src/services/auth.ts");
  assert.match(auth, /redactAuthFromUrl/);
  assert.match(auth, /\[redacted\]/);
  assert.match(auth, /searchParams\.set/);
});

test("App.tsx send flow applies auth after variable resolution", () => {
  const app = read("src/renderer/src/App.tsx");

  assert.match(app, /from "\.\/services\/auth"/);
  assert.match(app, /applyAuth/);
  assert.match(app, /resolveAuthConfig/);
  assert.match(app, /redactAuthFromUrl/);

  // Auth is applied before executeHttpRequest
  const sendFn = app.slice(app.indexOf("async function sendSelectedRequest"), app.indexOf("useEffect", app.indexOf("async function sendSelectedRequest")));
  assert.match(sendFn, /applyAuth/);
  assert.match(sendFn, /authUrl/);
  assert.match(sendFn, /authHeaders/);
  assert.match(sendFn, /redactAuthFromUrl.*historyUrl/s);
  assert.match(sendFn, /url: historyUrl/);
});

test("SavedRequest type includes authConfig and auth service has AuthConfig type", () => {
  const types = read("src/renderer/src/types.ts");
  assert.match(types, /export interface AuthConfig/);
  assert.match(types, /username\?: string/);
  assert.match(types, /password\?: string/);
  assert.match(types, /token\?: string/);
  assert.match(types, /keyName\?: string/);
  assert.match(types, /keyValue\?: string/);
  assert.match(types, /placement\?: "header" \| "query"/);
  assert.match(types, /authConfig: AuthConfig/);
});

test("auth tab UI shows config fields for the active mode", () => {
  const app = read("src/renderer/src/App.tsx");

  assert.match(app, /aria-label="API request authentication"/);
  assert.match(app, /aria-label="Basic auth credentials"/);
  assert.match(app, /aria-label="Bearer token credential"/);
  assert.match(app, /aria-label="API key credentials"/);
  assert.match(app, /updateAuthConfig/);
  assert.match(app, /authConfig\?\.username/);
  assert.match(app, /authConfig\?\.token/);
  assert.match(app, /authConfig\?\.keyName/);
  assert.match(app, /authConfig\?\.placement/);
});

test("Rust persistence stores auth_config on requests", () => {
  const persistence = read("src-tauri/src/persistence.rs");

  assert.match(persistence, /pub auth_config: String/);
  assert.match(persistence, /ensure_auth_config_column/);
  assert.match(persistence, /ALTER TABLE requests ADD COLUMN auth_config TEXT/);

  // Loaded with default empty object when NULL
  assert.match(persistence, /auth_config: row\.\d\.unwrap_or/);
  assert.match(persistence, /"\{\}"\.to_string/);

  // Saved in INSERT and ON CONFLICT UPDATE
  const saveStart = persistence.indexOf("pub fn save_request");
  const saveBody = persistence.slice(saveStart, saveStart + 800);
  assert.match(saveBody, /auth_config/);

  // create_request initializes to "{}"
  const createStart = persistence.indexOf("pub fn create_request");
  const createBody = persistence.slice(createStart, createStart + 400);
  assert.match(createBody, /auth_config.*\{\}/s);
});
