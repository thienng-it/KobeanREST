import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const hasFile = (path) => existsSync(new URL(path, root));

test("Rust native core exposes an execute_http_request command", () => {
  assert.equal(hasFile("src-tauri/src/http_client.rs"), true);

  const httpClient = read("src-tauri/src/http_client.rs");
  assert.match(httpClient, /pub async fn execute_http_request/);
  assert.match(httpClient, /ExecuteHttpRequest/);
  assert.match(httpClient, /ExecuteHttpResponse/);
  assert.match(httpClient, /reqwest::Client/);
  assert.match(httpClient, /timeout_ms/);
  assert.match(httpClient, /follow_redirects/);

  const lib = read("src-tauri/src/lib.rs");
  assert.match(lib, /mod http_client;/);
  assert.match(lib, /execute_http_request/);
});

test("frontend API client invokes the Tauri command and has a browser preview fallback", () => {
  assert.equal(hasFile("src/renderer/src/services/http-client.ts"), true);

  const client = read("src/renderer/src/services/http-client.ts");
  assert.match(client, /invoke<ExecuteHttpResponse>\("execute_http_request"/);
  assert.match(client, /createPreviewResponse/);
  assert.match(client, /window\.__TAURI_INTERNALS__/);
});

test("request builder UI sends selected requests and renders dynamic response state", () => {
  const app = read("src/renderer/src/App.tsx");

  assert.match(app, /sendSelectedRequest/);
  assert.match(app, /isSending/);
  assert.match(app, /setResponseState/);
  assert.match(app, /(selectedRequest|draftRequest)\.timeoutMs/);
  assert.match(app, /responseState\.kind === "success"/);
  assert.match(app, /responseState\.kind === "error"/);
});

test("saved request model includes MVP execution options", () => {
  const types = read("src/renderer/src/types.ts");
  const sample = read("src/renderer/src/data/sample-workspace.ts");

  assert.match(types, /timeoutMs: number/);
  assert.match(types, /followRedirects: boolean/);
  assert.match(sample, /timeoutMs/);
  assert.match(sample, /followRedirects/);
});
