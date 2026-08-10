import * as vscode from "vscode";
import type { WebviewPanelManager } from "../webview/panel-manager.js";
import type { CollectionTreeProvider } from "../views/collection-tree-provider.js";
import type { EnvironmentTreeProvider } from "../views/environment-tree-provider.js";
import type { HistoryTreeProvider } from "../views/history-tree-provider.js";
import type { WorkspaceStorageService } from "../services/workspace-storage.js";
import type { SecretStorageService } from "../services/secret-storage.js";
import type { HttpEngine } from "../services/http-engine.js";
import type { VariableResolver } from "../services/variable-resolver.js";
import type { AuthService } from "../services/auth-service.js";
import type { ScriptRunner } from "../services/script-runner.js";
import { parseHttpFile } from "../language/http-file-parser.js";
import { ResponseViewerPanel } from "../views/response-viewer.js";

export interface CommandDependencies {
  panelManager: WebviewPanelManager;
  collectionTreeProvider: CollectionTreeProvider;
  environmentTreeProvider: EnvironmentTreeProvider;
  historyTreeProvider: HistoryTreeProvider;
  workspaceStorage: WorkspaceStorageService;
  secretStorage: SecretStorageService;
  httpEngine: HttpEngine;
  variableResolver: VariableResolver;
  authService: AuthService;
  scriptRunner: ScriptRunner;
  outputChannel: vscode.OutputChannel;
}

export function registerCommands(
  context: vscode.ExtensionContext,
  deps: CommandDependencies,
): void {
  const {
    panelManager,
    collectionTreeProvider,
    environmentTreeProvider,
    historyTreeProvider,
    workspaceStorage,
    httpEngine,
    variableResolver,
    outputChannel,
  } = deps;

  // --- Set Active Environment ---
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "kobeanrest.setActiveEnvironment",
      (envName: string) => {
        if (!envName) return;
        workspaceStorage.setActiveEnvironment(envName);
        environmentTreeProvider.refresh();
        vscode.window.showInformationMessage(`Active environment set to ${envName}`);
      },
    ),
  );

  // --- Open KobeanREST Panel ---
  context.subscriptions.push(
    vscode.commands.registerCommand("kobeanrest.openPanel", () => {
      panelManager.show();
    }),
  );

  // --- Send Request (from .http file or tree view) ---
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "kobeanrest.sendRequest",
      async (_arg?: unknown) => {
        try {
          const editor = vscode.window.activeTextEditor;
          if (!editor || editor.document.languageId !== "http") {
            vscode.window.showWarningMessage(
              "Open a .http file to send a request.",
            );
            return;
          }

          const doc = editor.document;
          const cursorLine = editor.selection.active.line;
          const parsed = parseHttpFile(doc.getText());

          // Find the request block containing the cursor
          const request = parsed.find(
            (r) => cursorLine >= r.startLine && cursorLine <= r.endLine,
          );
          if (!request) {
            vscode.window.showWarningMessage(
              "Place your cursor inside a request block.",
            );
            return;
          }

          outputChannel.appendLine(
            `Sending ${request.method} ${request.url}...`,
          );

          const variables = variableResolver.getActiveVariableMap();
          const resolvedUrl = variableResolver.resolveString(
            request.url,
            variables,
          );
          const resolvedHeaders = request.headers.map((h) => ({
            key: variableResolver.resolveString(h.key, variables),
            value: variableResolver.resolveString(h.value, variables),
            enabled: true,
          }));
          const resolvedBody = request.body
            ? variableResolver.resolveString(request.body, variables)
            : undefined;

          const response = await httpEngine.execute({
            method: request.method,
            url: resolvedUrl,
            headers: resolvedHeaders,
            body: resolvedBody,
            timeoutMs:
              vscode.workspace
                .getConfiguration("kobeanrest")
                .get<number>("defaultTimeout") ?? 30000,
            followRedirects:
              vscode.workspace
                .getConfiguration("kobeanrest")
                .get<boolean>("followRedirects") ?? true,
          });

          // Record history
          workspaceStorage.addHistoryEntry({
            method: request.method,
            url: resolvedUrl,
            status: response.status,
            durationMs: response.durationMs,
            sizeBytes: response.sizeBytes,
            createdAt: new Date().toISOString(),
          });
          historyTreeProvider.refresh();

          // Show response
          ResponseViewerPanel.show(context, response, request.method, resolvedUrl);

          outputChannel.appendLine(
            `${response.status} ${response.statusText} (${response.durationMs}ms, ${response.sizeBytes} bytes)`,
          );
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`Request failed: ${message}`);
          outputChannel.appendLine(`Error: ${message}`);
        }
      },
    ),
  );

  // --- New Request ---
  context.subscriptions.push(
    vscode.commands.registerCommand("kobeanrest.newRequest", async () => {
      panelManager.triggerNewRequest();
    }),
  );

  // --- New Collection ---
  context.subscriptions.push(
    vscode.commands.registerCommand("kobeanrest.newCollection", async () => {
      const name = await vscode.window.showInputBox({
        prompt: "Collection name",
        placeHolder: "My API Collection",
      });
      if (!name) return;

      workspaceStorage.createCollection(name);
      collectionTreeProvider.refresh();
      vscode.window.showInformationMessage(
        `Collection "${name}" created.`,
      );
    }),
  );

  // --- Import Collection ---
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "kobeanrest.importCollection",
      async () => {
        const file = await vscode.window.showOpenDialog({
          canSelectMany: false,
          filters: {
            "API Collections": ["json", "yaml", "yml"],
          },
          openLabel: "Import",
        });
        if (!file?.[0]) return;

        try {
          const content = await vscode.workspace.fs.readFile(file[0]);
          const text = Buffer.from(content).toString("utf-8");
          workspaceStorage.importCollection(text);
          collectionTreeProvider.refresh();
          vscode.window.showInformationMessage("Collection imported.");
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`Import failed: ${message}`);
        }
      },
    ),
  );

  // --- Export Collection ---
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "kobeanrest.exportCollection",
      async () => {
        const data = workspaceStorage.exportAllCollections();
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file("kobeanrest-export.json"),
          filters: { JSON: ["json"] },
        });
        if (!uri) return;

        await vscode.workspace.fs.writeFile(
          uri,
          Buffer.from(JSON.stringify(data, null, 2)),
        );
        vscode.window.showInformationMessage("Collection exported.");
      },
    ),
  );

  // --- Run Collection ---
  context.subscriptions.push(
    vscode.commands.registerCommand("kobeanrest.runCollection", async () => {
      panelManager.show();
      vscode.window.showInformationMessage(
        "Collection Runner opened in KobeanREST panel.",
      );
    }),
  );

  // --- Open QA Dashboard ---
  context.subscriptions.push(
    vscode.commands.registerCommand("kobeanrest.openDashboard", () => {
      panelManager.show();
    }),
  );

  // --- Manage Environments ---
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "kobeanrest.manageEnvironments",
      () => {
        panelManager.show();
      },
    ),
  );

  // --- Generate Code Snippet ---
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "kobeanrest.generateCodeSnippet",
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== "http") {
          vscode.window.showWarningMessage(
            "Open a .http file first.",
          );
          return;
        }

        const parsed = parseHttpFile(editor.document.getText());
        const cursorLine = editor.selection.active.line;
        const request = parsed.find(
          (r) => cursorLine >= r.startLine && cursorLine <= r.endLine,
        );
        if (!request) return;

        const lang = await vscode.window.showQuickPick(
          [
            "cURL",
            "JavaScript (fetch)",
            "Python (requests)",
            "Go (net/http)",
            "Java (HttpClient)",
          ],
          { placeHolder: "Select language" },
        );
        if (!lang) return;

        let snippet = "";
        if (lang === "cURL") {
          snippet = `curl -X ${request.method} '${request.url}'`;
          for (const h of request.headers) {
            snippet += ` \\\n  -H '${h.key}: ${h.value}'`;
          }
          if (request.body) {
            snippet += ` \\\n  -d '${request.body}'`;
          }
        } else if (lang === "JavaScript (fetch)") {
          const opts: Record<string, unknown> = { method: request.method };
          if (request.headers.length > 0) {
            opts.headers = Object.fromEntries(
              request.headers.map((h) => [h.key, h.value]),
            );
          }
          if (request.body) opts.body = request.body;
          snippet = `const response = await fetch('${request.url}', ${JSON.stringify(opts, null, 2)});\nconst data = await response.json();\nconsole.log(data);`;
        } else if (lang === "Python (requests)") {
          snippet = `import requests\n\nresponse = requests.${request.method.toLowerCase()}('${request.url}'`;
          if (request.headers.length > 0) {
            const hdrs = Object.fromEntries(
              request.headers.map((h) => [h.key, h.value]),
            );
            snippet += `, headers=${JSON.stringify(hdrs)}`;
          }
          if (request.body) snippet += `, data='${request.body}'`;
          snippet += ")\nprint(response.json())";
        } else {
          snippet = `// Code generation for ${lang} — coming soon`;
        }

        const doc = await vscode.workspace.openTextDocument({
          content: snippet,
          language: lang.startsWith("cURL")
            ? "shellscript"
            : lang.includes("JavaScript")
              ? "javascript"
              : lang.includes("Python")
                ? "python"
                : "plaintext",
        });
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
      },
    ),
  );

  // --- Copy as cURL ---
  context.subscriptions.push(
    vscode.commands.registerCommand("kobeanrest.copyAsCurl", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== "http") return;

      const parsed = parseHttpFile(editor.document.getText());
      const cursorLine = editor.selection.active.line;
      const request = parsed.find(
        (r) => cursorLine >= r.startLine && cursorLine <= r.endLine,
      );
      if (!request) return;

      let curl = `curl -X ${request.method} '${request.url}'`;
      for (const h of request.headers) {
        curl += ` -H '${h.key}: ${h.value}'`;
      }
      if (request.body) {
        curl += ` -d '${request.body.replace(/'/g, "'\\''")}'`;
      }

      await vscode.env.clipboard.writeText(curl);
      vscode.window.showInformationMessage("cURL command copied.");
    }),
  );

  // --- Clear History ---
  context.subscriptions.push(
    vscode.commands.registerCommand("kobeanrest.clearHistory", () => {
      workspaceStorage.clearHistory();
      historyTreeProvider.refresh();
      vscode.window.showInformationMessage("History cleared.");
    }),
  );

  // --- Refresh Collections ---
  context.subscriptions.push(
    vscode.commands.registerCommand("kobeanrest.refreshCollections", () => {
      collectionTreeProvider.refresh();
      environmentTreeProvider.refresh();
      historyTreeProvider.refresh();
      panelManager.notifyWorkspaceUpdated();
    }),
  );

  // --- Delete Item ---
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "kobeanrest.deleteItem",
      async (item: { id: string; contextValue: string }) => {
        if (!item) return;
        const confirm = await vscode.window.showWarningMessage(
          `Delete this ${item.contextValue}?`,
          { modal: true },
          "Delete",
        );
        if (confirm !== "Delete") return;

        workspaceStorage.deleteItem(item.id, item.contextValue);
        collectionTreeProvider.refresh();
      },
    ),
  );

  // --- Duplicate Request ---
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "kobeanrest.duplicateRequest",
      (item: { id: string }) => {
        if (!item) return;
        workspaceStorage.duplicateRequest(item.id);
        collectionTreeProvider.refresh();
      },
    ),
  );
}
