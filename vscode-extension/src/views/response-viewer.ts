import * as vscode from "vscode";
import type { HttpResponse } from "../services/http-engine.js";

/**
 * Displays HTTP responses in a dedicated webview panel.
 * Shows status code, timing breakdown, headers table, and formatted body.
 */
export class ResponseViewerPanel {
  private static panel: vscode.WebviewPanel | undefined;

  static show(
    _context: vscode.ExtensionContext,
    response: HttpResponse,
    method: string,
    url: string,
  ): void {
    if (this.panel) {
      this.panel.webview.html = this.getHtml(response, method, url);
      this.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "kobeanrest.response",
      `Response ${response.status}`,
      vscode.ViewColumn.Beside,
      { enableScripts: false },
    );

    this.panel.webview.html = this.getHtml(response, method, url);

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  private static getHtml(
    response: HttpResponse,
    method: string,
    url: string,
  ): string {
    const statusColor =
      response.status >= 200 && response.status < 300
        ? "#22c55e"
        : response.status >= 400
          ? "#ef4444"
          : response.status >= 300
            ? "#f59e0b"
            : "#6b7280";

    const formatBody = (): string => {
      if (!response.bodyText) {
        return response.bodyBase64
          ? `<pre style="opacity:0.6">[Binary data: ${formatBytes(response.sizeBytes)}]</pre>`
          : "<em>No body</em>";
      }

      // Try to format as JSON
      try {
        const parsed = JSON.parse(response.bodyText);
        return `<pre>${escapeHtml(JSON.stringify(parsed, null, 2))}</pre>`;
      } catch {
        // Return as-is
        return `<pre>${escapeHtml(response.bodyText)}</pre>`;
      }
    };

    const headersHtml = response.headers
      .map(
        (h) =>
          `<tr><td style="font-weight:600;white-space:nowrap;padding:4px 12px 4px 0">${escapeHtml(h.key)}</td><td style="padding:4px 0;word-break:break-all">${escapeHtml(h.value)}</td></tr>`,
      )
      .join("\n");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: var(--vscode-font-family, -apple-system, system-ui, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 16px;
      margin: 0;
      line-height: 1.5;
    }
    .status-bar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 16px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 6px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .status-code {
      font-size: 1.4em;
      font-weight: 700;
      color: ${statusColor};
    }
    .status-text { opacity: 0.8; }
    .timing-chip {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.85em;
    }
    .method-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 0.85em;
      background: ${statusColor}22;
      color: ${statusColor};
    }
    .section-title {
      font-weight: 600;
      margin: 20px 0 8px;
      font-size: 0.95em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.7;
    }
    .timing-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
      gap: 8px;
      margin-bottom: 16px;
    }
    .timing-item {
      background: var(--vscode-editor-inactiveSelectionBackground);
      padding: 8px 12px;
      border-radius: 4px;
      text-align: center;
    }
    .timing-label { font-size: 0.8em; opacity: 0.6; }
    .timing-value { font-weight: 700; font-size: 1.1em; }
    table { width: 100%; border-collapse: collapse; }
    pre {
      background: var(--vscode-textCodeBlock-background);
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: var(--vscode-editor-font-size, 13px);
      max-height: 60vh;
      overflow-y: auto;
    }
    .url { opacity: 0.7; font-size: 0.9em; word-break: break-all; }
  </style>
</head>
<body>
  <div class="status-bar">
    <span class="method-badge">${method}</span>
    <span class="status-code">${response.status}</span>
    <span class="status-text">${escapeHtml(response.statusText)}</span>
    <span class="timing-chip">⏱ ${response.durationMs}ms</span>
    <span class="timing-chip">📦 ${formatBytes(response.sizeBytes)}</span>
  </div>

  <div class="url">${escapeHtml(url)}</div>

  <div class="section-title">Timing Breakdown</div>
  <div class="timing-grid">
    <div class="timing-item">
      <div class="timing-label">DNS</div>
      <div class="timing-value">${response.dnsMs}ms</div>
    </div>
    <div class="timing-item">
      <div class="timing-label">Connect</div>
      <div class="timing-value">${response.connectMs}ms</div>
    </div>
    <div class="timing-item">
      <div class="timing-label">TLS</div>
      <div class="timing-value">${response.tlsMs}ms</div>
    </div>
    <div class="timing-item">
      <div class="timing-label">Total</div>
      <div class="timing-value">${response.durationMs}ms</div>
    </div>
  </div>

  <div class="section-title">Response Headers (${response.headers.length})</div>
  <table>${headersHtml}</table>

  <div class="section-title">Response Body</div>
  ${formatBody()}
</body>
</html>`;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
