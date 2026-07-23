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
    id: "test-status-200",
    label: "Test: Status code is 200",
    mode: "javascript",
    scope: "post",
    body: `kb.test("Status code is 200", () => {
  kb.expect(kb.response.status).toBe(200);
});`,
  },
  {
    id: "test-response-body",
    label: "Test: Response body has field",
    mode: "javascript",
    scope: "post",
    body: `kb.test("Response has data field", () => {
  const jsonData = kb.response.json();
  kb.expect(jsonData).toHaveProperty("data");
});`,
  },
  {
    id: "test-response-time",
    label: "Test: Response time < 500ms",
    mode: "javascript",
    scope: "post",
    body: `kb.test("Response time is acceptable", () => {
  kb.expect(kb.response.durationMs).toBeLessThan(500);
});`,
  },
  {
    id: "status-assertion",
    label: "Assert 2xx status (throws)",
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

// ---------------------------------------------------------------------------
// cURL import – parse a curl command string into request fields
// ---------------------------------------------------------------------------

export interface CurlImportResult {
  method: import("../types").HttpMethod;
  customMethod?: string;
  url: string;
  headers: Array<{ key: string; value: string; enabled: boolean }>;
  body: string;
  bodyMimeType: string;
  bodyForm: Array<{ key: string; value: string; enabled: boolean }>;
  authMode: import("../types").ApiAuthMode;
  authConfig: import("../types").AuthConfig;
}

/**
 * Parse a curl command string and return fields compatible with SavedRequest.
 * Supports common flags: -X, -H, -d/--data/--data-raw/--data-binary,
 * -u/--user, --url, and quoted arguments (single, double, ANSI-C $'...').
 */
export function parseCurlCommand(raw: string): CurlImportResult {
  // Normalise line continuations (\<newline>) and collapse to single line
  const cleaned = raw
    .replace(/\\\r?\n/g, " ")
    .replace(/\r?\n/g, " ")
    .trim();

  const tokens = tokenize(cleaned);

  // Drop leading "curl" token if present
  if (tokens.length > 0 && tokens[0].toLowerCase() === "curl") {
    tokens.shift();
  }

  let method: string | undefined;
  let url = "";
  const headers: Array<{ key: string; value: string; enabled: boolean }> = [];
  let body = "";
  let authMode: import("../types").ApiAuthMode = "none";
  let authConfig: import("../types").AuthConfig = {};
  let dataFlagUsed: string | undefined;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === "-X" || token === "--request") {
      method = tokens[++i]?.toUpperCase();
    } else if (token === "-H" || token === "--header") {
      const headerStr = tokens[++i] ?? "";
      const colonIdx = headerStr.indexOf(":");
      if (colonIdx > 0) {
        headers.push({
          key: headerStr.slice(0, colonIdx).trim(),
          value: headerStr.slice(colonIdx + 1).trim(),
          enabled: true,
        });
      }
    } else if (
      token === "-d" ||
      token === "--data" ||
      token === "--data-raw" ||
      token === "--data-binary" ||
      token === "--data-ascii" ||
      token === "--data-urlencode" ||
      token === "--json"
    ) {
      if (!dataFlagUsed) dataFlagUsed = token;
      let chunk = tokens[++i] ?? "";
      if (token === "--data-urlencode") {
        // curl --data-urlencode semantics:
        //   "name=content" → name=<urlencode(content)>
        //   "=content"     → <urlencode(content)>
        //   "content"      → <urlencode(content)>
        const eqIdx = chunk.indexOf("=");
        if (eqIdx > 0) {
          chunk = chunk.slice(0, eqIdx + 1) + encodeURIComponent(chunk.slice(eqIdx + 1));
        } else if (eqIdx === 0) {
          chunk = encodeURIComponent(chunk.slice(1));
        } else {
          chunk = encodeURIComponent(chunk);
        }
      }
      // Multiple data flags are concatenated with & (same as real curl)
      body = body ? body + "&" + chunk : chunk;
      if (token === "--json") {
        // --json implies Content-Type + Accept if not already set
        if (!headers.some((h) => h.key.toLowerCase() === "content-type")) {
          headers.push({ key: "Content-Type", value: "application/json", enabled: true });
        }
        if (!headers.some((h) => h.key.toLowerCase() === "accept")) {
          headers.push({ key: "Accept", value: "application/json", enabled: true });
        }
      }
    } else if (token === "-u" || token === "--user") {
      const cred = tokens[++i] ?? "";
      const sepIdx = cred.indexOf(":");
      authMode = "basic";
      if (sepIdx > 0) {
        authConfig = { username: cred.slice(0, sepIdx), password: cred.slice(sepIdx + 1) };
      } else {
        authConfig = { username: cred, password: "" };
      }
    } else if (token === "--url") {
      url = tokens[++i] ?? "";
    } else if (token.startsWith("-")) {
      // Known flags that take a value argument (not already handled above)
      const VALUE_FLAGS = new Set([
        "-o", "--output", "-O",
        "-e", "--referer",
        "-A", "--user-agent",
        "-b", "--cookie", "-c", "--cookie-jar",
        "--connect-timeout", "-m", "--max-time",
        "--retry", "--retry-delay",
        "-w", "--write-out",
        "-T", "--upload-file",
        "--proxy", "-x",
        "--cert", "--key", "--cacert",
        "--resolve", "--interface",
        "--max-redirs",
        "-r", "--range",
        "--limit-rate",
      ]);
      if (VALUE_FLAGS.has(token)) {
        i++; // consume the value
      }
      // Boolean / no-arg flags (-k, -v, -L, -s, --compressed, etc.)
      // are implicitly skipped without consuming the next token
    } else if (!url) {
      // Bare positional argument = URL
      url = token;
    }
  }

  // Default method based on whether body is present
  if (!method) {
    method = body ? "POST" : "GET";
  }

  // Check if it's a bearer token via Authorization header
  const authHeader = headers.find(
    (h) => h.key.toLowerCase() === "authorization",
  );
  if (authHeader && authMode === "none") {
    const val = authHeader.value;
    if (/^Bearer\s+/i.test(val)) {
      authMode = "bearer";
      authConfig = { token: val.replace(/^Bearer\s+/i, "") };
      // Remove the authorization header since it's captured in auth config
      const idx = headers.indexOf(authHeader);
      headers.splice(idx, 1);
    }
  }

  const KNOWN_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
  const knownMethod = KNOWN_METHODS.find((m) => m === method);

  // Derive bodyMimeType: explicit Content-Type header wins, then infer from flag
  const ctHeader = headers.find((h) => h.key.toLowerCase() === "content-type");
  let bodyMimeType = "text/plain";
  if (ctHeader) {
    bodyMimeType = ctHeader.value;
  } else if (dataFlagUsed === "--json") {
    bodyMimeType = "application/json";
  } else if (
    dataFlagUsed === "--data-urlencode" ||
    dataFlagUsed === "-d" ||
    dataFlagUsed === "--data" ||
    dataFlagUsed === "--data-ascii"
  ) {
    bodyMimeType = "application/x-www-form-urlencoded";
  } else if (dataFlagUsed === "--data-binary" || dataFlagUsed === "--data-raw") {
    bodyMimeType = "application/octet-stream";
  }

  // When body is form-urlencoded, parse into key/value form entries (decoded)
  const bodyForm: Array<{ key: string; value: string; enabled: boolean }> = [];
  if (bodyMimeType === "application/x-www-form-urlencoded" && body) {
    const params = new URLSearchParams(body);
    params.forEach((value, key) => {
      bodyForm.push({ key, value, enabled: true });
    });
  }

  return {
    method: knownMethod ?? "CUSTOM",
    customMethod: knownMethod ? undefined : method,
    url,
    headers,
    body,
    bodyMimeType,
    bodyForm,
    authMode,
    authConfig,
  };
}

/**
 * Tokenize a curl command string, respecting single-quotes, double-quotes,
 * and ANSI-C $'...' quoting with common escape sequences.
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < input.length) {
    // Skip whitespace
    while (i < input.length && /\s/.test(input[i])) i++;
    if (i >= input.length) break;

    let token = "";

    while (i < input.length && !/\s/.test(input[i])) {
      const ch = input[i];

      if (ch === "'") {
        // Single-quoted string: no escaping at all
        i++;
        while (i < input.length && input[i] !== "'") {
          token += input[i++];
        }
        i++; // skip closing '
      } else if (ch === "$" && i + 1 < input.length && input[i + 1] === "'") {
        // ANSI-C quoting $'...'
        i += 2;
        while (i < input.length && input[i] !== "'") {
          if (input[i] === "\\" && i + 1 < input.length) {
            const esc = input[i + 1];
            i += 2;
            switch (esc) {
              case "n": token += "\n"; break;
              case "t": token += "\t"; break;
              case "r": token += "\r"; break;
              case "\\": token += "\\"; break;
              case "'": token += "'"; break;
              case '"': token += '"'; break;
              default: token += "\\" + esc;
            }
          } else {
            token += input[i++];
          }
        }
        i++; // skip closing '
      } else if (ch === '"') {
        // Double-quoted string: only \ escaping for \ " $ `
        i++;
        while (i < input.length && input[i] !== '"') {
          if (input[i] === "\\" && i + 1 < input.length) {
            const next = input[i + 1];
            if (next === '"' || next === "\\" || next === "$" || next === "`") {
              token += next;
              i += 2;
            } else {
              token += input[i++];
            }
          } else {
            token += input[i++];
          }
        }
        i++; // skip closing "
      } else if (ch === "\\" && i + 1 < input.length) {
        // Backslash escape outside quotes
        token += input[i + 1];
        i += 2;
      } else {
        token += ch;
        i++;
      }
    }

    if (token.length > 0) {
      tokens.push(token);
    }
  }

  return tokens;
}
