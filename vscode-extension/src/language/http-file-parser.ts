/**
 * Parsed request block from an .http file.
 */
export interface ParsedHttpRequest {
  /** The name from @name directive, if present. */
  name?: string;
  method: string;
  url: string;
  headers: Array<{ key: string; value: string }>;
  body?: string;
  /** Line number where the request starts (0-indexed). */
  startLine: number;
  /** Line number where the request ends (0-indexed). */
  endLine: number;
  /** File-level variables defined before this request. */
  fileVariables: Map<string, string>;
}

/**
 * Parses an .http file into an array of request blocks.
 * Supports ### separators, @name directives, file-level variables,
 * headers, and request bodies.
 */
export function parseHttpFile(content: string): ParsedHttpRequest[] {
  const lines = content.split(/\r?\n/);
  const requests: ParsedHttpRequest[] = [];
  const fileVariables = new Map<string, string>();

  const METHOD_RE =
    /^\s*(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE|CONNECT|PROPFIND|PROPPATCH|MKCOL|COPY|MOVE|LOCK|UNLOCK|QUERY)\s+(.+?)(?:\s+HTTP\/\S+)?\s*$/;
  const HEADER_RE = /^([\w-]+)\s*:\s*(.+)$/;
  const VARIABLE_DEF_RE = /^@(\w[\w-]*)\s*=\s*(.+)$/;
  const NAME_DIRECTIVE_RE = /^#\s*@name\s+(.+)$/;
  const SEPARATOR_RE = /^###/;
  const COMMENT_RE = /^\s*(#(?!#)|\/\/)/;

  let current: ParsedHttpRequest | null = null;
  let inBody = false;
  let bodyLines: string[] = [];
  let pendingName: string | undefined;

  function finalizeCurrent(endLine: number): void {
    if (current) {
      if (bodyLines.length > 0) {
        // Trim trailing empty lines from body
        while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === "") {
          bodyLines.pop();
        }
        if (bodyLines.length > 0) {
          current.body = bodyLines.join("\n");
        }
      }
      current.endLine = endLine;
      requests.push(current);
      current = null;
      inBody = false;
      bodyLines = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Separator
    if (SEPARATOR_RE.test(line)) {
      finalizeCurrent(i > 0 ? i - 1 : 0);
      pendingName = undefined;
      continue;
    }

    // File-level variable definition
    const varMatch = VARIABLE_DEF_RE.exec(line);
    if (varMatch && !inBody) {
      fileVariables.set(varMatch[1], varMatch[2].trim());
      continue;
    }

    // Name directive
    const nameMatch = NAME_DIRECTIVE_RE.exec(line);
    if (nameMatch && !inBody) {
      pendingName = nameMatch[1].trim();
      continue;
    }

    // Skip comments (but not inside body)
    if (COMMENT_RE.test(line) && !inBody) {
      continue;
    }

    // Request line (method + URL)
    const methodMatch = METHOD_RE.exec(line);
    if (methodMatch && !inBody) {
      finalizeCurrent(i > 0 ? i - 1 : 0);
      current = {
        name: pendingName,
        method: methodMatch[1],
        url: methodMatch[2].trim(),
        headers: [],
        startLine: i,
        endLine: i,
        fileVariables: new Map(fileVariables),
      };
      pendingName = undefined;
      continue;
    }

    // Header line (only if we have a current request and haven't entered body)
    if (current && !inBody) {
      const headerMatch = HEADER_RE.exec(line);
      if (headerMatch) {
        current.headers.push({
          key: headerMatch[1],
          value: headerMatch[2].trim(),
        });
        continue;
      }

      // Empty line marks start of body
      if (line.trim() === "") {
        inBody = true;
        continue;
      }
    }

    // Body line
    if (current && inBody) {
      bodyLines.push(line);
    }
  }

  // Finalize the last request
  finalizeCurrent(lines.length - 1);

  return requests;
}

/**
 * Finds the request block at a given line number.
 */
export function findRequestAtLine(
  requests: ParsedHttpRequest[],
  line: number,
): ParsedHttpRequest | undefined {
  return requests.find((r) => line >= r.startLine && line <= r.endLine);
}
