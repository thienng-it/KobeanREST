import * as vscode from "vscode";

/**
 * Makes URLs in .http files clickable, opening them in the browser.
 */
export class HttpDocumentLinkProvider implements vscode.DocumentLinkProvider {
  provideDocumentLinks(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): vscode.DocumentLink[] {
    const links: vscode.DocumentLink[] = [];
    const urlPattern =
      /https?:\/\/[^\s'"}\]>)]+/g;

    for (let i = 0; i < document.lineCount; i++) {
      const lineText = document.lineAt(i).text;
      let match;

      while ((match = urlPattern.exec(lineText)) !== null) {
        // Skip URLs with unresolved variables
        if (match[0].includes("{{")) continue;

        try {
          const uri = vscode.Uri.parse(match[0]);
          const range = new vscode.Range(
            i,
            match.index,
            i,
            match.index + match[0].length,
          );
          links.push(new vscode.DocumentLink(range, uri));
        } catch {
          // Invalid URL, skip
        }
      }
    }

    return links;
  }
}
