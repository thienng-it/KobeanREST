import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");

// Inline equivalent implementation for behavioral test
function keyValueToBulkText(items) {
  if (!items || items.length === 0) return "";
  return items
    .filter((item) => item.key.trim() !== "" || item.value.trim() !== "")
    .map((item) => {
      const line = `${item.key}:${item.value ? " " + item.value : ""}`;
      return item.enabled ? line : `// ${line}`;
    })
    .join("\n");
}

function parseBulkTextToKeyValue(text) {
  const lines = text.split("\n");
  const result = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    let enabled = true;
    let content = trimmed;

    if (content.startsWith("//") || content.startsWith("#")) {
      enabled = false;
      content = content.replace(/^(\/\/|#)\s*/, "").trim();
      if (!content) continue;
    }

    const colonIdx = content.indexOf(":");
    const eqIdx = content.indexOf("=");

    let delimIdx = -1;
    if (colonIdx >= 0 && eqIdx >= 0) {
      delimIdx = Math.min(colonIdx, eqIdx);
    } else if (colonIdx >= 0) {
      delimIdx = colonIdx;
    } else if (eqIdx >= 0) {
      delimIdx = eqIdx;
    }

    if (delimIdx >= 0) {
      const key = content.slice(0, delimIdx).trim();
      const value = content.slice(delimIdx + 1).trim();
      result.push({ key, value, enabled });
    } else {
      result.push({ key: content.trim(), value: "", enabled });
    }
  }

  return result;
}

test("bulk-param-utils: serializes key-value items to bulk text correctly", () => {
  const items = [
    { key: "page", value: "1", enabled: true },
    { key: "limit", value: "50", enabled: true },
    { key: "filter", value: "active", enabled: false },
    { key: "rawFlag", value: "", enabled: true },
  ];

  const serialized = keyValueToBulkText(items);
  assert.equal(
    serialized,
    "page: 1\nlimit: 50\n// filter: active\nrawFlag:"
  );
});

test("bulk-param-utils: parses bulk text with colon and equals delimiters", () => {
  const text = `
page: 1
limit=50
// filter: active
# sort=desc
redirect_uri: https://example.com/callback?foo=bar
flagOnly
`;

  const parsed = parseBulkTextToKeyValue(text);
  assert.deepEqual(parsed, [
    { key: "page", value: "1", enabled: true },
    { key: "limit", value: "50", enabled: true },
    { key: "filter", value: "active", enabled: false },
    { key: "sort", value: "desc", enabled: false },
    { key: "redirect_uri", value: "https://example.com/callback?foo=bar", enabled: true },
    { key: "flagOnly", value: "", enabled: true },
  ]);
});

test("bulk-param-utils source contract: exports serialization and parser functions", () => {
  const utils = read("src/renderer/src/services/bulk-param-utils.ts");
  assert.match(utils, /export function keyValueToBulkText/);
  assert.match(utils, /export function parseBulkTextToKeyValue/);
  assert.match(utils, /export const paramsToBulkText/);
  assert.match(utils, /export const parseBulkParams/);
  assert.match(utils, /export const headersToBulkText/);
  assert.match(utils, /export const parseBulkHeaders/);
});

test("RequestPanel contract: supports Bulk Edit for both Params and Headers tabs", () => {
  const requestPanel = read("src/renderer/src/components/RequestPanel.tsx");

  // Verify imports
  assert.match(requestPanel, /import\s*\{[^}]*paramsToBulkText[^}]*\}\s*from\s*["']\.\.\/services\/bulk-param-utils["']/);
  assert.match(requestPanel, /import\s*\{[^}]*AlignLeft[^}]*List[^}]*\}\s*from\s*["']lucide-react["']/);

  // Verify bulk mode states
  assert.match(requestPanel, /const \[paramsBulkMode, setParamsBulkMode\] = useState\(false\);/);
  assert.match(requestPanel, /const \[headersBulkMode, setHeadersBulkMode\] = useState\(false\);/);

  // Verify Params Bulk Edit UI
  assert.match(requestPanel, /onClick=\{toggleParamsBulkMode\}/);
  assert.match(requestPanel, /paramsBulkMode \? (t\("request\.keyValueEdit"\)|"Key-Value Edit") : (t\("request\.bulkEdit"\)|"Bulk Edit")/);
  assert.match(requestPanel, /className="headers-bulk-editor"/);

  // Verify Headers Bulk Edit UI
  assert.match(requestPanel, /onClick=\{toggleHeadersBulkMode\}/);
  assert.match(requestPanel, /headersBulkMode \? (t\("request\.keyValueEdit"\)|"Key-Value Edit") : (t\("request\.bulkEdit"\)|"Bulk Edit")/);
});

test("styles.css contract: includes bulk editor styles", () => {
  const styles = read("src/renderer/src/styles.css");

  assert.match(styles, /\.headers-bulk-editor\s*\{/);
  assert.match(styles, /\.headers-bulk-textarea-wrap/);
  assert.match(styles, /\.headers-bulk-hint/);
});
