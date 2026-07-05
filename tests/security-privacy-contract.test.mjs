import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const hasFile = (path) => existsSync(new URL(path, root));

test("diagnostic errors go through a shared redaction helper before logging or alerts", () => {
  assert.equal(hasFile("src/renderer/src/services/redaction.ts"), true);

  const redaction = read("src/renderer/src/services/redaction.ts");
  const app = read("src/renderer/src/App.tsx");

  assert.match(redaction, /export function redactDiagnosticError/);
  assert.match(redaction, /Authorization/i);
  assert.match(redaction, /\[redacted\]/);
  assert.match(redaction, /api[_-]?key|token|secret|password/i);

  assert.match(app, /import \{ redactDiagnosticError \} from "\.\/services\/redaction"/);
  assert.match(app, /function diagnosticMessage\(error: unknown\)/);
  assert.match(app, /console\.error\([^)]*diagnosticMessage\(error\)|console\.error\([^)]*diagnosticMessage\(err\)/);
  assert.doesNotMatch(app, /console\.error\(err\)/);
  assert.doesNotMatch(app, /console\.error\("Failed to .*", err\)/);
  assert.doesNotMatch(app, /alert\("Failed to .*" \+ err\)/);
});

test("repo includes a source and config secret scan that skips generated output", () => {
  assert.equal(hasFile(".betterleak"), true);
  assert.equal(hasFile("scripts/check-secrets.mjs"), true);
  assert.equal(hasFile(".github/workflows/sensitive-data.yml"), true);

  const betterleak = read(".betterleak");
  const script = read("scripts/check-secrets.mjs");
  const workflow = read(".github/workflows/sensitive-data.yml");
  const pkg = read("package.json");
  const roadmap = read("docs/implementation-roadmap.md");

  assert.match(pkg, /"check:secrets": "node scripts\/check-secrets\.mjs"/);
  assert.match(script, /\.betterleak/);
  assert.match(betterleak, /docs-site/);
  assert.match(betterleak, /PRIVATE KEY/);
  assert.match(betterleak, /github_pat_|AKIA|sk-/);
  assert.match(workflow, /npm run check:secrets/);
  assert.match(workflow, /pull_request/);
  assert.match(betterleak, /node_modules/);
  assert.match(betterleak, /dist/);
  assert.match(betterleak, /src-tauri\/target/);
  assert.match(script, /process\.exit\(1\)/);

  assert.match(roadmap, /Source\/config secret scan before release/);
});
