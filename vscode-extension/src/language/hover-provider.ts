import * as vscode from "vscode";
import type { VariableResolver } from "../services/variable-resolver.js";

const HEADER_DOCS: Record<string, string> = {
  "content-type": "Indicates the media type of the resource. [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type)",
  "authorization": "Contains credentials for authenticating a user agent with a server. [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Authorization)",
  "accept": "Advertises which content types the client is able to understand. [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept)",
  "cache-control": "Directives for caching mechanisms in both requests and responses. [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)",
  "user-agent": "Contains a characteristic string that identifies the requesting application, operating system, vendor, or version. [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/User-Agent)",
  "host": "Specifies the host and port number of the server to which the request is being sent. [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Host)",
  "origin": "Indicates the origin that caused the request. Used for CORS. [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Origin)",
  "cookie": "Contains stored HTTP cookies previously sent by the server. [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cookie)",
  "referer": "Contains the address of the previous web page from which a link was followed. [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referer)",
};

const METHOD_DOCS: Record<string, string> = {
  GET: "**GET** — Requests a representation of the specified resource. Should only retrieve data.",
  POST: "**POST** — Submits an entity to the specified resource, often causing a change in state or side effects on the server.",
  PUT: "**PUT** — Replaces all current representations of the target resource with the request payload.",
  PATCH: "**PATCH** — Applies partial modifications to a resource.",
  DELETE: "**DELETE** — Deletes the specified resource.",
  HEAD: "**HEAD** — Identical to GET but without the response body. Useful for checking headers.",
  OPTIONS: "**OPTIONS** — Describes the communication options for the target resource. Used in CORS preflight.",
  TRACE: "**TRACE** — Performs a message loop-back test along the path to the target resource.",
};

/**
 * Hover information for .http files.
 * Shows variable values, HTTP method documentation, and header documentation.
 */
export class HttpHoverProvider implements vscode.HoverProvider {
  constructor(private readonly resolver: VariableResolver) {}

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
  ): vscode.Hover | null {
    const lineText = document.lineAt(position.line).text;
    const wordRange = document.getWordRangeAtPosition(position);
    const word = wordRange ? document.getText(wordRange) : "";

    // Variable hover: {{variableName}}
    const varPattern = /\{\{([^}]+)\}\}/g;
    let match;
    while ((match = varPattern.exec(lineText)) !== null) {
      const varStart = match.index;
      const varEnd = varStart + match[0].length;
      if (position.character >= varStart && position.character <= varEnd) {
        const varName = match[1].trim();
        const value = this.resolver.getVariableValue(varName);
        const env = this.resolver.getActiveVariableMap();
        const envName = (this.resolver as { storage: { getActiveEnvironmentName(): string } })
          .storage?.getActiveEnvironmentName?.() ?? "Active Environment";

        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        if (value !== undefined) {
          md.appendMarkdown(`**\`{{${varName}}}\`**\n\n`);
          md.appendMarkdown(`**Value:** \`${value}\`\n\n`);
          md.appendMarkdown(`*From: ${envName}*`);
        } else {
          md.appendMarkdown(`**\`{{${varName}}}\`** — ⚠️ Unresolved\n\n`);
          md.appendMarkdown(`Variable not found in the active environment.`);
        }

        return new vscode.Hover(
          md,
          new vscode.Range(
            position.line,
            varStart,
            position.line,
            varEnd,
          ),
        );
      }
    }

    // HTTP method hover
    const methodMatch = /^\s*(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE)\b/.exec(
      lineText,
    );
    if (methodMatch && wordRange) {
      const method = methodMatch[1];
      if (METHOD_DOCS[method]) {
        return new vscode.Hover(new vscode.MarkdownString(METHOD_DOCS[method]));
      }
    }

    // Header hover
    const headerMatch = /^([\w-]+)\s*:/.exec(lineText);
    if (headerMatch) {
      const headerName = headerMatch[1].toLowerCase();
      if (HEADER_DOCS[headerName] && position.character < headerMatch[0].length) {
        return new vscode.Hover(
          new vscode.MarkdownString(HEADER_DOCS[headerName]),
        );
      }
    }

    return null;
  }
}
