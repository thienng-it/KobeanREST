import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { executeHttpRequest } from './httpProxy';

export class KobeanWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'kobeanrest.sidebarView';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this._extensionUri.fsPath, 'dist-webview')),
        vscode.Uri.file(path.join(this._extensionUri.fsPath, 'media')),
      ],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview, 'sidebar');
    this._setupMessageListener(webviewView.webview);
  }

  public static createOrShowPanel(extensionUri: vscode.Uri): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      'kobeanrestEditor',
      'KobeanREST API Client',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(extensionUri.fsPath, 'dist-webview')),
          vscode.Uri.file(path.join(extensionUri.fsPath, 'media')),
        ],
      }
    );

    const provider = new KobeanWebviewProvider(extensionUri);
    panel.webview.html = provider._getHtmlForWebview(panel.webview, 'editor');
    provider._setupMessageListener(panel.webview);

    return panel;
  }

  private _setupMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(async (message: any) => {
      switch (message.type) {
        case 'executeHttpRequest': {
          try {
            const result = await executeHttpRequest(message.payload);
            webview.postMessage({
              type: 'httpResponse',
              requestId: message.requestId,
              payload: result,
            });
          } catch (err: any) {
            webview.postMessage({
              type: 'httpError',
              requestId: message.requestId,
              error: err?.message || String(err),
            });
          }
          break;
        }
        case 'showInformationMessage': {
          vscode.window.showInformationMessage(message.text);
          break;
        }
        case 'showErrorMessage': {
          vscode.window.showErrorMessage(message.text);
          break;
        }
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview, viewMode: 'editor' | 'sidebar' = 'editor'): string {
    const distWebviewPath = path.join(this._extensionUri.fsPath, 'dist-webview');
    const indexPath = path.join(distWebviewPath, 'index.html');

    if (!fs.existsSync(indexPath)) {
      return `<!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><title>KobeanREST</title></head>
        <body style="font-family: sans-serif; padding: 20px; color: var(--vscode-foreground);">
          <h2>KobeanREST Webview Asset Not Found</h2>
          <p>Please run <code>npm run build:webview</code> to generate dist-webview assets.</p>
        </body>
        </html>`;
    }

    let html = fs.readFileSync(indexPath, 'utf-8');

    // Add view-mode attribute to html element
    html = html.replace('<html lang="en">', `<html lang="en" data-view-mode="${viewMode}">`);

    // Rewrite script src and link href attributes to use webview URIs
    const webviewUriBase = webview.asWebviewUri(vscode.Uri.file(distWebviewPath)).toString();

    html = html.replace(/(href|src)="(\.\/|\/)?([^"]+)"/g, (match, p1, p2, p3) => {
      if (p3.startsWith('http://') || p3.startsWith('https://') || p3.startsWith('data:')) {
        return match;
      }
      const assetUri = webview.asWebviewUri(vscode.Uri.file(path.join(distWebviewPath, p3))).toString();
      return `${p1}="${assetUri}"`;
    });

    // Inject VS Code Webview CSP and theme listener helper
    const cspStr = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'; font-src ${webview.cspSource} data:; connect-src ${webview.cspSource} https: http:;">`;

    html = html.replace('<head>', `<head>\n  ${cspStr}`);

    // Inject webview-overrides.css for responsive IDE styling
    const mediaPath = path.join(this._extensionUri.fsPath, 'media', 'webview-overrides.css');
    if (fs.existsSync(mediaPath)) {
      const overrideCssUri = webview.asWebviewUri(vscode.Uri.file(mediaPath)).toString();
      html = html.replace('</head>', `  <link rel="stylesheet" href="${overrideCssUri}">\n  </head>`);
    }

    // Inject theme-sync script: detects VS Code theme class and applies matching data-theme
    const themeSyncScript = `
      <script>
        (function() {
          function syncTheme() {
            var body = document.body;
            var root = document.documentElement;
            var isDark = body.classList.contains('vscode-dark') || body.classList.contains('vscode-high-contrast');
            var isLight = body.classList.contains('vscode-light') || body.classList.contains('vscode-high-contrast-light');
            if (isDark) {
              root.setAttribute('data-theme', 'dark');
            } else if (isLight) {
              root.setAttribute('data-theme', 'light');
            }
          }
          syncTheme();
          var observer = new MutationObserver(syncTheme);
          observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        })();
      </script>`;
    html = html.replace('</head>', `${themeSyncScript}\n  </head>`);

    return html;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
