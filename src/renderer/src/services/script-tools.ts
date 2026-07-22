import type { SavedRequest } from "../types";
import { resolvedMethodLabel } from "../components/MethodSelector";

export type ScriptEditorMode = "javascript" | "json" | "xml" | "text" | "mcp";

export interface ScriptEditorModeOption {
  value: ScriptEditorMode;
  label: string;
}

export interface ScriptSnippet {
  id: string;
  label: string;
  mode: ScriptEditorMode;
  /** Where this template applies: pre-request, post-response, or both. */
  scope: "pre" | "post" | "both";
  body: string;
}

export type RequestCodeSnippetTarget = "curl" | "fetch" | "node";

export const SCRIPT_EDITOR_MODES: ScriptEditorModeOption[] = [
  { value: "javascript", label: "JavaScript" },
  { value: "json", label: "JSON" },
  { value: "xml", label: "XML" },
  { value: "text", label: "Text" },
  { value: "mcp", label: "MCP" },
];

export const SCRIPT_SNIPPETS: ScriptSnippet[] = [
  // --- Pre-request templates ---
  {
    id: "set-header",
    label: "Set request header",
    mode: "javascript",
    scope: "pre",
    body: `kb.request.setHeader("X-Trace-Id", kb.variables.traceId ?? crypto.randomUUID());`,
  },
  {
    id: "bearer-token",
    label: "Inject bearer token",
    mode: "javascript",
    scope: "pre",
    body: `// Reads an OAuth/Bearer token from the environment and attaches it.
const token = kb.environment.get("authToken");
if (token) {
  kb.request.setHeader("Authorization", \`Bearer \${token}\`);
}`,
  },
  {
    id: "correlation-id",
    label: "Add correlation ID",
    mode: "javascript",
    scope: "pre",
    body: `// Generates a per-request correlation ID and reuses it if set earlier.
const correlationId = kb.environment.get("correlationId") ?? crypto.randomUUID();
kb.environment.set("correlationId", correlationId);
kb.request.setHeader("X-Correlation-Id", correlationId);`,
  },
  {
    id: "timestamp-header",
    label: "Add timestamp header",
    mode: "javascript",
    scope: "pre",
    body: `kb.request.setHeader("X-Timestamp", new Date().toISOString());`,
  },
  {
    id: "set-method",
    label: "Override method & URL",
    mode: "javascript",
    scope: "pre",
    body: `kb.request.method = "POST";
kb.request.url = kb.variables.baseUrl + "/users";`,
  },
  {
    id: "set-json-body",
    label: "Build JSON body from variables",
    mode: "javascript",
    scope: "pre",
    body: `kb.request.bodyMimeType = "application/json";
kb.request.body = JSON.stringify({
  source: "kobeanrest",
  user: kb.variables.username ?? "anonymous",
  timestamp: new Date().toISOString(),
});`,
  },
  {
    id: "merge-query-param",
    label: "Append query parameter",
    mode: "javascript",
    scope: "pre",
    body: `// Adds ?ref=kobeanrest without clobbering existing query string.
const url = new URL(kb.request.url);
url.searchParams.set("ref", "kobeanrest");
kb.request.url = url.toString();`,
  },
  {
    id: "remove-header",
    label: "Remove a request header",
    mode: "javascript",
    scope: "pre",
    body: `kb.request.removeHeader("Cookie");`,
  },

  // --- Post-response templates ---
  {
    id: "status-assertion",
    label: "Assert 2xx status",
    mode: "javascript",
    scope: "post",
    body: `if (kb.response.status < 200 || kb.response.status >= 300) {
  throw new Error(\`Expected 2xx status, received \${kb.response.status}\`);
}`,
  },
  {
    id: "extract-token",
    label: "Extract & persist auth token",
    mode: "javascript",
    scope: "post",
    body: `// Saves an access_token from the response into the active environment.
const token = kb.response.json()?.access_token;
if (token) {
  kb.environment.set("authToken", token);
  console.log("Stored new auth token.");
} else {
  throw new Error("Response did not contain access_token");
}`,
  },
  {
    id: "extract-value",
    label: "Extract & store a field",
    mode: "javascript",
    scope: "post",
    body: `const data = kb.response.json();
kb.environment.set("userId", String(data.id ?? ""));
console.log("Stored userId:", kb.environment.get("userId"));`,
  },
  {
    id: "pagination-cursor",
    label: "Store next page cursor",
    mode: "javascript",
    scope: "post",
    body: `const next = kb.response.json()?.pagination?.next_cursor;
if (next) {
  kb.environment.set("nextCursor", String(next));
} else {
  // No more pages — clear the cursor so the next run stops paging.
  kb.environment.set("nextCursor", "");
}`,
  },
  {
    id: "response-json",
    label: "Read response JSON",
    mode: "javascript",
    scope: "post",
    body: `const data = kb.response.json();
console.log("response data", data);`,
  },
  {
    id: "log-timing",
    label: "Log response timing",
    mode: "javascript",
    scope: "post",
    body: `console.log(\`\${kb.request.method} \${kb.request.url} -> \${kb.response.status} in \${kb.response.durationMs}ms (\${kb.response.sizeBytes} bytes)\`);`,
  },
  {
    id: "log-on-error",
    label: "Log body on error",
    mode: "javascript",
    scope: "post",
    body: `if (kb.response.status >= 400) {
  console.error("Request failed:", kb.response.status, kb.response.text());
}`,
  },

  // --- General (work in both pre and post) ---
  {
    id: "set-variable",
    label: "Set variable (persisted)",
    mode: "javascript",
    scope: "both",
    body: `kb.environment.set("myVar", "value");`,
  },
  {
    id: "read-variable",
    label: "Read a variable",
    mode: "javascript",
    scope: "both",
    body: `const value = kb.environment.get("myVar");
console.log("myVar =", value);`,
  },

  // --- MCP payloads ---
  {
    id: "mcp-initialize",
    label: "MCP initialize payload",
    mode: "mcp",
    scope: "both",
    body: `{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": {},
    "clientInfo": {
      "name": "KobeanREST",
      "version": "0.1.2"
    }
  }
}`,
  },
  {
    id: "mcp-tools-list",
    label: "MCP list tools",
    mode: "mcp",
    scope: "both",
    body: `{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}`,
  },
  {
    id: "mcp-tool-call",
    label: "MCP call tool",
    mode: "mcp",
    scope: "both",
    body: `{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "tool_name",
    "arguments": {}
  }
}`,
  },
];

/** Snippet groups for the template dropdown, in display order. */
export const SCRIPT_SNIPPET_GROUPS: Array<{
  label: string;
  scope: ScriptSnippet["scope"];
  mode?: ScriptEditorMode;
}> = [
  { label: "Pre-request", scope: "pre" },
  { label: "Post-response", scope: "post" },
  { label: "General", scope: "both" },
  { label: "MCP", scope: "both", mode: "mcp" },
];

/** Snippets belonging to a group: matched by scope; MCP group additionally requires mode === "mcp",
 *  and the plain "General" group excludes mcp-mode snippets so the two "both"-scope groups don't overlap. */
export function snippetsForGroup(
  group: { scope: ScriptSnippet["scope"]; mode?: ScriptEditorMode },
): ScriptSnippet[] {
  return SCRIPT_SNIPPETS.filter((snippet) => {
    if (snippet.scope !== group.scope) return false;
    if (group.mode === "mcp") return snippet.mode === "mcp";
    return snippet.mode !== "mcp";
  });
}

export function prettifyScriptContent(content: string, mode: ScriptEditorMode): string {
  if (!content.trim()) return content;

  if (mode === "json" || mode === "mcp") {
    return JSON.stringify(JSON.parse(content), null, 2);
  }

  if (mode === "xml") {
    return prettifyXml(content);
  }

  if (mode === "javascript") {
    return prettifyJavaScriptLike(content);
  }

  return content;
}

function prettifyJavaScriptLike(content: string): string {
  return content
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\{\s*\n/g, "{\n")
    .replace(/\n\s*\}/g, "\n}");
}

function prettifyXml(content: string): string {
  const normalized = content.replace(/>\s*</g, "><").trim();
  const tokens = normalized.replace(/(>)(<)(\/*)/g, "$1\n$2$3").split("\n");
  let depth = 0;

  return tokens
    .map((token) => {
      const trimmed = token.trim();
      if (!trimmed) return "";
      if (/^<\//.test(trimmed)) {
        depth = Math.max(depth - 1, 0);
      }
      const line = `${"  ".repeat(depth)}${trimmed}`;
      if (/^<[^!?/][^>]*[^/]>\s*$/.test(trimmed) && !/^<[^>]+>[^<]+<\/[^>]+>$/.test(trimmed)) {
        depth += 1;
      }
      return line;
    })
    .filter(Boolean)
    .join("\n");
}

export function generateRequestCodeSnippet(
  request: SavedRequest,
  target: RequestCodeSnippetTarget,
): string {
  if (target === "curl") {
    return generateCurlSnippet(request);
  }
  if (target === "node") {
    return generateNodeSnippet(request);
  }
  return generateFetchSnippet(request);
}

function generateCurlSnippet(request: SavedRequest): string {
  const method = resolvedMethodLabel(request.method, request.customMethod);
  const parts = [`curl -X ${method} ${quoteShell(request.url)}`];
  for (const header of request.headers.filter((item) => item.enabled && item.key.trim())) {
    parts.push(`  -H ${quoteShell(`${header.key}: ${header.value}`)}`);
  }
  if (request.body.trim()) {
    parts.push(`  --data-raw ${quoteShell(request.body)}`);
  }
  return parts.join(" \\\n");
}

function generateFetchSnippet(request: SavedRequest): string {
  const method = resolvedMethodLabel(request.method, request.customMethod);
  const headers = request.headers.filter((item) => item.enabled && item.key.trim());
  const headerBlock = headers.length
    ? `,\n  headers: ${JSON.stringify(Object.fromEntries(headers.map((header) => [header.key, header.value])), null, 2)
        .replace(/\n/g, "\n  ")}`
    : "";
  const bodyBlock = request.body.trim() ? `,\n  body: ${JSON.stringify(request.body)}` : "";
  return `await fetch(${JSON.stringify(request.url)}, {
  method: ${JSON.stringify(method)}${headerBlock}${bodyBlock}
});`;
}

function generateNodeSnippet(request: SavedRequest): string {
  const fetchSnippet = generateFetchSnippet(request);
  return `const response = ${fetchSnippet}
console.log(response.status, await response.text());`;
}

function quoteShell(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
