"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.KobeanWebviewProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const httpProxy_1 = require("./httpProxy");
class KobeanWebviewProvider {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    resolveWebviewView(webviewView, _context, _token) {
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
    static createOrShowPanel(extensionUri) {
        const panel = vscode.window.createWebviewPanel('kobeanrestEditor', 'KobeanREST API Client', vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(extensionUri.fsPath, 'dist-webview')),
                vscode.Uri.file(path.join(extensionUri.fsPath, 'media')),
            ],
        });
        const provider = new KobeanWebviewProvider(extensionUri);
        panel.webview.html = provider._getHtmlForWebview(panel.webview, 'editor');
        provider._setupMessageListener(panel.webview);
        return panel;
    }
    _setupMessageListener(webview) {
        webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'executeHttpRequest': {
                    try {
                        const result = await (0, httpProxy_1.executeHttpRequest)(message.payload);
                        webview.postMessage({
                            type: 'httpResponse',
                            requestId: message.requestId,
                            payload: result,
                        });
                    }
                    catch (err) {
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
    _getHtmlForWebview(webview, viewMode = 'editor') {
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
exports.KobeanWebviewProvider = KobeanWebviewProvider;
KobeanWebviewProvider.viewType = 'kobeanrest.sidebarView';
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
//# sourceMappingURL=KobeanWebviewProvider.js.map