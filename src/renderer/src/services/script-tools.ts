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
  {
    id: "set-header",
    label: "Set request header",
    mode: "javascript",
    body: `request.headers = [
  ...(request.headers ?? []),
  { key: "X-Trace-Id", value: variables.traceId ?? "{{$guid}}", enabled: true },
];`,
  },
  {
    id: "set-json-body",
    label: "Set JSON body",
    mode: "javascript",
    body: `request.bodyMimeType = "application/json";
request.body = JSON.stringify({
  source: "kobeanrest",
  timestamp: new Date().toISOString(),
});`,
  },
  {
    id: "set-variable",
    label: "Set variable",
    mode: "javascript",
    body: `variables.nextToken = response?.body
  ? JSON.parse(response.body).token
  : variables.nextToken;`,
  },
  {
    id: "response-json",
    label: "Read response JSON",
    mode: "javascript",
    body: `const data = JSON.parse(response.body);
console.log("response data", data);`,
  },
  {
    id: "status-test",
    label: "Status assertion",
    mode: "javascript",
    body: `if (response.status < 200 || response.status >= 300) {
  throw new Error(\`Expected 2xx status, received \${response.status}\`);
}`,
  },
  {
    id: "timing-log",
    label: "Log response time",
    mode: "javascript",
    body: `console.log(\`Response completed in \${response.durationMs}ms\`);`,
  },
  {
    id: "mcp-initialize",
    label: "MCP initialize payload",
    mode: "mcp",
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
