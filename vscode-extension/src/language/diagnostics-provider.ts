import * as vscode from "vscode";
import type { VariableResolver } from "../services/variable-resolver.js";
import { parseHttpFile } from "./http-file-parser.js";

/**
 * Real-time diagnostics for .http files.
 * Validates URLs, detects unresolved variables, duplicate headers, missing Content-Type.
 */
export class HttpDiagnosticsProvider implements vscode.Disposable {
  private readonly diagnosticCollection: vscode.DiagnosticCollection;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly resolver: VariableResolver) {
    this.diagnosticCollection =
      vscode.languages.createDiagnosticCollection("kobeanrest");

    // Update on document change
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.languageId === "http") {
          this.updateDiagnostics(e.document);
        }
      }),
    );

    // Update on document open
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument((doc) => {
        if (doc.languageId === "http") {
          this.updateDiagnostics(doc);
        }
      }),
    );

    // Clear on close
    this.disposables.push(
      vscode.workspace.onDidCloseTextDocument((doc) => {
        this.diagnosticCollection.delete(doc.uri);
      }),
    );

    // Initial scan of open editors
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.languageId === "http") {
        this.updateDiagnostics(editor.document);
      }
    }
  }

  private updateDiagnostics(document: vscode.TextDocument): void {
    const diagnostics: vscode.Diagnostic[] = [];
    const lines = document.getText().split(/\r?\n/);
    const parsed = parseHttpFile(document.getText());

    // Check each request
    for (const request of parsed) {
      // Validate URL
      const urlLine = lines[request.startLine];
      const resolvedUrl = this.resolver.resolveString(
        request.url,
        this.resolver.getActiveVariableMap(),
      );
      if (!resolvedUrl.includes("{{")) {
        try {
          new URL(resolvedUrl);
        } catch {
          const urlStart = urlLine.indexOf(request.url);
          diagnostics.push({
            range: new vscode.Range(
              request.startLine,
              urlStart >= 0 ? urlStart : 0,
              request.startLine,
              urlLine.length,
            ),
            message: `Invalid URL: "${resolvedUrl}"`,
            severity: vscode.DiagnosticSeverity.Error,
            source: "KobeanREST",
          });
        }
      }

      // Check for unresolved variables
      const allText = [
        request.url,
        ...request.headers.map((h) => `${h.key}: ${h.value}`),
        request.body ?? "",
      ].join("\n");

      const varPattern = /\{\{([^}]+)\}\}/g;
      let match;
      while ((match = varPattern.exec(allText)) !== null) {
        const varName = match[1].trim();
        if (!varName.startsWith("$")) {
          const value = this.resolver.getVariableValue(varName);
          if (value === undefined) {
            // Find the line containing this variable
            for (let lineIdx = request.startLine; lineIdx <= request.endLine; lineIdx++) {
              const line = lines[lineIdx];
              if (line && line.includes(`{{${varName}}}`)) {
                const col = line.indexOf(`{{${varName}}}`);
                diagnostics.push({
                  range: new vscode.Range(
                    lineIdx,
                    col,
                    lineIdx,
                    col + match[0].length,
                  ),
                  message: `Unresolved variable: "${varName}". Define it in the active environment.`,
                  severity: vscode.DiagnosticSeverity.Warning,
                  source: "KobeanREST",
                });
                break;
              }
            }
          }
        }
      }

      // Missing Content-Type for POST/PUT/PATCH with body
      if (
        ["POST", "PUT", "PATCH"].includes(request.method) &&
        request.body &&
        !request.headers.some(
          (h) => h.key.toLowerCase() === "content-type",
        )
      ) {
        diagnostics.push({
          range: new vscode.Range(
            request.startLine,
            0,
            request.startLine,
            lines[request.startLine].length,
          ),
          message:
            "Missing Content-Type header. Consider adding Content-Type for requests with a body.",
          severity: vscode.DiagnosticSeverity.Warning,
          source: "KobeanREST",
        });
      }

      // Duplicate headers
      const headerCounts = new Map<string, number>();
      for (const h of request.headers) {
        const key = h.key.toLowerCase();
        headerCounts.set(key, (headerCounts.get(key) ?? 0) + 1);
      }
      for (const [key, count] of headerCounts) {
        if (count > 1) {
          for (
            let lineIdx = request.startLine;
            lineIdx <= request.endLine;
            lineIdx++
          ) {
            const line = lines[lineIdx];
            if (line && line.toLowerCase().startsWith(key + ":")) {
              diagnostics.push({
                range: new vscode.Range(
                  lineIdx,
                  0,
                  lineIdx,
                  line.length,
                ),
                message: `Duplicate header: "${key}" appears ${count} times.`,
                severity: vscode.DiagnosticSeverity.Information,
                source: "KobeanREST",
              });
            }
          }
        }
      }
    }

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  dispose(): void {
    this.diagnosticCollection.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
