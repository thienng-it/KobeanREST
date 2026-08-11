import * as vscode from "vscode";
import type { VariableResolver } from "../services/variable-resolver.js";

const HTTP_METHODS = [
  { label: "GET", detail: "Retrieve a resource" },
  { label: "POST", detail: "Create a resource" },
  { label: "PUT", detail: "Replace a resource" },
  { label: "PATCH", detail: "Partially update a resource" },
  { label: "DELETE", detail: "Delete a resource" },
  { label: "HEAD", detail: "Retrieve headers only" },
  { label: "OPTIONS", detail: "Describe communication options" },
  { label: "TRACE", detail: "Perform a message loop-back test" },
];

const COMMON_HEADERS = [
  { label: "Content-Type", detail: "Media type of the body" },
  { label: "Authorization", detail: "Authentication credentials" },
  { label: "Accept", detail: "Media types accepted by the client" },
  { label: "Accept-Encoding", detail: "Acceptable encodings" },
  { label: "Accept-Language", detail: "Acceptable languages" },
  { label: "Cache-Control", detail: "Caching directives" },
  { label: "Content-Length", detail: "Size of the body in bytes" },
  { label: "Cookie", detail: "HTTP cookies" },
  { label: "Host", detail: "Server domain name" },
  { label: "If-None-Match", detail: "Conditional ETag match" },
  { label: "If-Modified-Since", detail: "Conditional date match" },
  { label: "Origin", detail: "Request origin for CORS" },
  { label: "Referer", detail: "Address of the previous page" },
  { label: "User-Agent", detail: "Client application identifier" },
  { label: "X-Request-ID", detail: "Unique request identifier" },
  { label: "X-API-Key", detail: "API key header" },
];

const MIME_TYPES = [
  "application/json",
  "application/xml",
  "application/x-www-form-urlencoded",
  "multipart/form-data",
  "text/plain",
  "text/html",
  "text/xml",
  "text/csv",
  "application/octet-stream",
  "application/javascript",
  "application/graphql",
  "application/yaml",
];

/**
 * IntelliSense completion provider for .http files.
 * Provides completions for methods, headers, MIME types, and {{variables}}.
 */
export class HttpCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private readonly resolver: VariableResolver) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext,
  ): vscode.CompletionItem[] {
    const lineText = document.lineAt(position.line).text;
    const linePrefix = lineText.substring(0, position.character);

    // Variable completions: after {{
    if (linePrefix.includes("{{")) {
      const lastOpen = linePrefix.lastIndexOf("{{");
      const afterBraces = linePrefix.substring(lastOpen + 2);
      if (!afterBraces.includes("}}")) {
        return this.getVariableCompletions(afterBraces);
      }
    }

    // Method completions: beginning of a line
    if (/^\s*\w*$/.test(linePrefix)) {
      return this.getMethodCompletions();
    }

    // MIME type completions: after Content-Type:
    if (/content-type\s*:\s*/i.test(linePrefix)) {
      return this.getMimeTypeCompletions();
    }

    // Header completions: beginning of a header line (after request line)
    const linesBefore = document.getText(
      new vscode.Range(0, 0, position.line, 0),
    );
    if (
      /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/m.test(linesBefore) &&
      /^[\w-]*$/.test(linePrefix.trim())
    ) {
      return this.getHeaderCompletions();
    }

    return [];
  }

  private getVariableCompletions(prefix: string): vscode.CompletionItem[] {
    const names = this.resolver.getAvailableVariableNames();
    return names
      .filter((n) => n.toLowerCase().startsWith(prefix.toLowerCase()))
      .map((name) => {
        const item = new vscode.CompletionItem(
          name,
          name.startsWith("$")
            ? vscode.CompletionItemKind.Function
            : vscode.CompletionItemKind.Variable,
        );
        item.detail = name.startsWith("$")
          ? `Dynamic: ${name}`
          : `Environment variable`;
        const value = this.resolver.getVariableValue(name);
        if (value) {
          item.documentation = new vscode.MarkdownString(
            `**Current value:** \`${value}\``,
          );
        }
        item.insertText = `${name}}}`;
        return item;
      });
  }

  private getMethodCompletions(): vscode.CompletionItem[] {
    return HTTP_METHODS.map((m) => {
      const item = new vscode.CompletionItem(
        m.label,
        vscode.CompletionItemKind.Keyword,
      );
      item.detail = m.detail;
      item.insertText = new vscode.SnippetString(
        `${m.label} \${1:https://api.example.com/}\n\${2:Content-Type: application/json}\n\n\${0}`,
      );
      return item;
    });
  }

  private getHeaderCompletions(): vscode.CompletionItem[] {
    return COMMON_HEADERS.map((h) => {
      const item = new vscode.CompletionItem(
        h.label,
        vscode.CompletionItemKind.Field,
      );
      item.detail = h.detail;
      item.insertText = new vscode.SnippetString(`${h.label}: \${1}`);
      return item;
    });
  }

  private getMimeTypeCompletions(): vscode.CompletionItem[] {
    return MIME_TYPES.map((mime) => {
      const item = new vscode.CompletionItem(
        mime,
        vscode.CompletionItemKind.EnumMember,
      );
      return item;
    });
  }
}
