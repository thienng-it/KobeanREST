import * as vscode from "vscode";
import * as crypto from "node:crypto";
import type { WorkspaceStorageService } from "../services/workspace-storage.js";
import type { SecretStorageService } from "../services/secret-storage.js";
import type { HttpEngine } from "../services/http-engine.js";

/**
 * Manages the main KobeanREST webview panel (singleton).
 * Embeds the full React application with strict CSP and theme synchronization.
 */
export class WebviewPanelManager {
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly storage: WorkspaceStorageService,
    private readonly secrets: SecretStorageService,
    private readonly httpEngine: HttpEngine,
  ) {}

  show(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    const distWebviewUri = vscode.Uri.joinPath(
      this.context.extensionUri,
      "dist-webview",
    );

    this.panel = vscode.window.createWebviewPanel(
      "kobeanrest.mainPanel",
      "KobeanREST",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [distWebviewUri],
      },
    );

    this.panel.iconPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      "media",
      "icon.png",
    );

    this.panel.webview.html = this.getHtml(this.panel.webview, distWebviewUri);

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      async (message: { type: string; payload?: unknown; requestId?: string }) => {
        try {
          const result = await this.handleMessage(message);
          if (message.requestId && this.panel) {
            this.panel.webview.postMessage({
              type: `${message.type}:response`,
              requestId: message.requestId,
              payload: result,
            });
          }
        } catch (err: unknown) {
          if (message.requestId && this.panel) {
            this.panel.webview.postMessage({
              type: `${message.type}:error`,
              requestId: message.requestId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      },
      undefined,
      this.context.subscriptions,
    );

    // Theme synchronization
    this.context.subscriptions.push(
      vscode.window.onDidChangeActiveColorTheme((theme) => {
        this.panel?.webview.postMessage({
          type: "themeChanged",
          payload: {
            kind: theme.kind === vscode.ColorThemeKind.Dark
              ? "dark"
              : theme.kind === vscode.ColorThemeKind.HighContrast
                ? "high-contrast"
                : "light",
          },
        });
      }),
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  triggerNewRequest(): void {
    if (this.panel) {
      this.panel.webview.postMessage({ type: "newRequest" });
      this.show();
    }
  }

  notifyWorkspaceUpdated(): void {
    if (this.panel) {
      this.panel.webview.postMessage({ type: "workspaceUpdated" });
    }
  }

  private async handleMessage(
    message: { type: string; payload?: unknown },
  ): Promise<unknown> {
    switch (message.type) {
      case "loadWorkspace":
        return this.storage.exportAllCollections();

      case "executeRequest":
        return this.httpEngine.execute(message.payload as Parameters<HttpEngine["execute"]>[0]);

      case "storeSecret": {
        const { key, value } = message.payload as { key: string; value: string };
        await this.secrets.store(key, value);
        return { success: true };
      }

      case "getSecret": {
        const { key } = message.payload as { key: string };
        const value = await this.secrets.get(key);
        return { key, value: value ?? null };
      }

      case "getCollections":
        return this.storage.getCollections();

      case "getEnvironments":
        return this.storage.getEnvironments();

      case "saveRequest": {
        const req = message.payload as any;
        const updated = this.storage.updateRequest(req);
        if (!updated) {
          // Fallback if request is not found anywhere
          this.storage.addRequest(req.folderId || req.collectionId, req);
        }
        vscode.commands.executeCommand("kobeanrest.refreshCollections");
        return { success: true };
      }

      case "deleteRequest": {
        const { id } = message.payload as { id: string };
        this.storage.deleteItem(id, "request");
        vscode.commands.executeCommand("kobeanrest.refreshCollections");
        return { success: true };
      }

      case "createRequest": {
        const { folderId } = message.payload as { folderId: string };
        const newReq = this.storage.addRequest(folderId, {
          name: "New Request",
          method: "GET",
          url: "",
          authMode: "none",
          authConfig: {},
          headers: [],
          body: "",
          bodyMimeType: "text/plain",
          bodyForm: [],
          queryParams: [],
          timeoutMs: 30000,
          followRedirects: true,
          folderId,
        });
        vscode.commands.executeCommand("kobeanrest.refreshCollections");
        return newReq;
      }

      case "createFolder": {
        const { collectionId, name } = message.payload as { collectionId: string, name: string };
        const newFolder = this.storage.createFolder(collectionId, name);
        vscode.commands.executeCommand("kobeanrest.refreshCollections");
        return newFolder;
      }

      case "createCollection": {
        const { name } = message.payload as { name: string };
        const col = this.storage.createCollection(name);
        vscode.commands.executeCommand("kobeanrest.refreshCollections");
        return col.id;
      }

      case "deleteFolder": {
        const { folderId } = message.payload as { folderId: string };
        this.storage.deleteItem(folderId, "folder");
        vscode.commands.executeCommand("kobeanrest.refreshCollections");
        return { success: true };
      }

      case "deleteCollection": {
        const { collectionId } = message.payload as { collectionId: string };
        this.storage.deleteItem(collectionId, "collection");
        vscode.commands.executeCommand("kobeanrest.refreshCollections");
        return { success: true };
      }

      case "updateFolder": {
        const { folderId, name } = message.payload as { folderId: string, name: string };
        this.storage.updateFolder(folderId, name);
        vscode.commands.executeCommand("kobeanrest.refreshCollections");
        return { success: true };
      }

      case "updateCollection": {
        const { collectionId, name } = message.payload as { collectionId: string, name: string };
        this.storage.updateCollection(collectionId, name);
        vscode.commands.executeCommand("kobeanrest.refreshCollections");
        return { success: true };
      }

      case "createEnvironment": {
        const { name } = message.payload as { name: string };
        this.storage.createEnvironment(name);
        vscode.commands.executeCommand("kobeanrest.refreshCollections");
        return [];
      }

      case "deleteEnvironment": {
        const { name } = message.payload as { name: string };
        this.storage.deleteEnvironment(name);
        vscode.commands.executeCommand("kobeanrest.refreshCollections");
        return { success: true };
      }

      case "recordHistory": {
        const entry = message.payload as any;
        this.storage.addHistoryEntry(entry);
        vscode.commands.executeCommand("kobeanrest.refreshCollections");
        return { success: true };
      }

      case "ready":
        return { version: "0.2.0" };

      default:
        return { error: `Unknown message type: ${message.type}` };
    }
  }

  private getHtml(
    webview: vscode.Webview,
    distWebviewUri: vscode.Uri,
  ): string {
    const nonce = crypto.randomBytes(16).toString("hex");
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distWebviewUri, "assets", "index.js"),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distWebviewUri, "assets", "index.css"),
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    style-src ${webview.cspSource} 'unsafe-inline';
    script-src ${webview.cspSource} 'nonce-${nonce}' 'unsafe-eval';
    img-src ${webview.cspSource} https: data:;
    font-src ${webview.cspSource} data:;
    connect-src https: http:;
  ">
  <title>KobeanREST</title>
  <link rel="stylesheet" href="${styleUri}">
  <script nonce="${nonce}">
    // Bridge: intercept Tauri checks and route through VS Code messaging
    window.__VSCODE_WEBVIEW__ = true;
    window.__TAURI_INTERNALS__ = undefined;
    const vscode = acquireVsCodeApi();
    window.__KOBEANREST_VSCODE__ = vscode;

    // Promise-based message bridge
    const pendingRequests = new Map();
    let requestCounter = 0;

    window.__kobeanrestInvoke = function(command, args) {
      return new Promise((resolve, reject) => {
        const requestId = String(++requestCounter);
        pendingRequests.set(requestId, { resolve, reject });
        vscode.postMessage({ type: command, payload: args, requestId });
      });
    };

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.requestId && pendingRequests.has(msg.requestId)) {
        const { resolve, reject } = pendingRequests.get(msg.requestId);
        pendingRequests.delete(msg.requestId);
        if (msg.type.endsWith(':error')) {
          reject(new Error(msg.error));
        } else {
          resolve(msg.payload);
        }
      }
    });
  </script>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }

  dispose(): void {
    this.panel?.dispose();
  }
}
