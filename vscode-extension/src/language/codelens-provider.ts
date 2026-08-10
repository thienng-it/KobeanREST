import * as vscode from "vscode";
import { parseHttpFile } from "./http-file-parser.js";

/**
 * Provides CodeLens actions above each HTTP request in .http files.
 * - "▶ Send Request" — executes the request
 * - "📋 Copy as cURL" — copies cURL command
 * - "⚡ Generate Code" — opens code snippet generator
 */
export class HttpCodeLensProvider implements vscode.CodeLensProvider {
  private onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.onDidChangeCodeLensesEmitter.event;

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): vscode.CodeLens[] {
    const parsed = parseHttpFile(document.getText());
    const lenses: vscode.CodeLens[] = [];

    for (const request of parsed) {
      const range = new vscode.Range(request.startLine, 0, request.startLine, 0);

      // Send Request
      lenses.push(
        new vscode.CodeLens(range, {
          title: "▶ Send Request",
          command: "kobeanrest.sendRequest",
          tooltip: `Send ${request.method} ${request.url}`,
        }),
      );

      // Copy as cURL
      lenses.push(
        new vscode.CodeLens(range, {
          title: "📋 Copy as cURL",
          command: "kobeanrest.copyAsCurl",
          tooltip: "Copy request as cURL command",
        }),
      );

      // Generate Code
      lenses.push(
        new vscode.CodeLens(range, {
          title: "⚡ Generate Code",
          command: "kobeanrest.generateCodeSnippet",
          tooltip: "Generate code snippet in various languages",
        }),
      );
    }

    return lenses;
  }
}
