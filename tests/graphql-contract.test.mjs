import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const hasFile = (path) => existsSync(new URL(path, root));

test("response-utils.ts defines strict GraphQL spec detection in analyzeGraphQLResponse", () => {
  assert.equal(hasFile("src/renderer/src/response-utils.ts"), true);
  const utils = read("src/renderer/src/response-utils.ts");

  assert.match(utils, /export function analyzeGraphQLResponse/);
  assert.match(utils, /isSpecCompliantGqlKeys/);
  assert.match(utils, /isGqlDataStructure/);
  assert.match(utils, /isGqlErrorsStructure/);
  assert.match(utils, /isExplicitGraphQLRequest/);
});

test("ResponsePanel.tsx computes isExplicitGraphQL and guards GraphQL status pill", () => {
  assert.equal(hasFile("src/renderer/src/components/ResponsePanel.tsx"), true);
  const panel = read("src/renderer/src/components/ResponsePanel.tsx");

  assert.match(panel, /isExplicitGraphQL/);
  assert.match(panel, /analyzeGraphQLResponse/);
  assert.match(panel, /GraphQL OK/);
  assert.match(panel, /GraphQL Errors/);
});
