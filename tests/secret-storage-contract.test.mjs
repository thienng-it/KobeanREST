import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const hasFile = (path) => existsSync(new URL(path, root));

test("SQLite stores secret metadata and redacted placeholders, not raw secret values", () => {
  const migration = read("src-tauri/migrations/001_initial.sql");
  assert.match(migration, /secret_ref TEXT/);
  assert.match(migration, /variable_value TEXT NOT NULL/);

  const persistence = read("src-tauri/src/persistence.rs");
  assert.match(persistence, /REDACTED_SECRET_VALUE/);
  assert.match(persistence, /secret_ref/);
  assert.doesNotMatch(persistence, /Stored in OS keychain/);
});

test("native core exposes keychain-backed secret commands", () => {
  assert.equal(hasFile("src-tauri/src/secrets.rs"), true);

  const secrets = read("src-tauri/src/secrets.rs");
  assert.match(secrets, /keyring::Entry/);
  assert.match(secrets, /pub fn store_secret/);
  assert.match(secrets, /pub fn delete_secret/);
  assert.match(secrets, /pub fn secret_ref/);
  assert.doesNotMatch(secrets, /println!/);
  assert.doesNotMatch(secrets, /eprintln!/);

  const cargo = read("src-tauri/Cargo.toml");
  assert.match(cargo, /keyring/);

  const lib = read("src-tauri/src/lib.rs");
  assert.match(lib, /mod secrets;/);
  assert.match(lib, /store_secret/);
  assert.match(lib, /delete_secret/);
});

test("renderer has a local secret service and redacts secret values in browser preview", () => {
  assert.equal(hasFile("src/renderer/src/services/secrets.ts"), true);

  const service = read("src/renderer/src/services/secrets.ts");
  assert.match(service, /invoke<SecretReference>\("store_secret"/);
  assert.match(service, /invoke<void>\("delete_secret"/);
  assert.match(service, /window\.__TAURI_INTERNALS__/);
  assert.doesNotMatch(service, /console\.log/);

  const sampleWorkspace = read("src/renderer/src/data/sample-workspace.ts");
  assert.match(sampleWorkspace, /secretRef/);
  assert.match(sampleWorkspace, /\[secret stored outside SQLite\]/);
  assert.doesNotMatch(sampleWorkspace, /Stored in OS keychain/);
});
