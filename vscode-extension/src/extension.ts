import * as vscode from "vscode";
import { registerCommands } from "./commands/index.js";
import { SecretStorageService } from "./services/secret-storage.js";
import { WorkspaceStorageService } from "./services/workspace-storage.js";
import { WebviewPanelManager } from "./webview/panel-manager.js";
import { CollectionTreeProvider } from "./views/collection-tree-provider.js";
import { EnvironmentTreeProvider } from "./views/environment-tree-provider.js";
import { HistoryTreeProvider } from "./views/history-tree-provider.js";
import { HttpCodeLensProvider } from "./language/codelens-provider.js";
import { HttpCompletionProvider } from "./language/completion-provider.js";
import { HttpDiagnosticsProvider } from "./language/diagnostics-provider.js";
import { HttpDocumentLinkProvider } from "./language/document-link-provider.js";
import { HttpHoverProvider } from "./language/hover-provider.js";
import { HttpEngine } from "./services/http-engine.js";
import { VariableResolver } from "./services/variable-resolver.js";
import { AuthService } from "./services/auth-service.js";
import { ScriptRunner } from "./services/script-runner.js";

const HTTP_SELECTOR: vscode.DocumentSelector = [
  { language: "http", scheme: "file" },
  { language: "http", scheme: "untitled" },
];

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel("KobeanREST");
  outputChannel.appendLine("KobeanREST extension activating...");

  // --- Core Services ---
  const secretStorage = new SecretStorageService(context);
  const workspaceStorage = new WorkspaceStorageService(context);
  const httpEngine = new HttpEngine(context);
  const variableResolver = new VariableResolver(workspaceStorage);
  const authService = new AuthService(secretStorage, variableResolver);
  const scriptRunner = new ScriptRunner(outputChannel);

  // --- Sidebar Tree Views ---
  const collectionTreeProvider = new CollectionTreeProvider(workspaceStorage);
  const environmentTreeProvider = new EnvironmentTreeProvider(workspaceStorage);
  const historyTreeProvider = new HistoryTreeProvider(workspaceStorage);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "kobeanrest-collections",
      collectionTreeProvider,
    ),
    vscode.window.registerTreeDataProvider(
      "kobeanrest-environments",
      environmentTreeProvider,
    ),
    vscode.window.registerTreeDataProvider(
      "kobeanrest-history",
      historyTreeProvider,
    ),
  );

  // --- Webview Panel ---
  const panelManager = new WebviewPanelManager(
    context,
    workspaceStorage,
    secretStorage,
    httpEngine,
  );

  context.subscriptions.push(
    workspaceStorage.onDidChangeWorkspaceData(() => {
      vscode.commands.executeCommand("kobeanrest.refreshCollections");
    }),
  );

  // --- Language Features (.http files) ---
  const diagnosticsProvider = new HttpDiagnosticsProvider(variableResolver);
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      HTTP_SELECTOR,
      new HttpCodeLensProvider(),
    ),
    vscode.languages.registerCompletionItemProvider(
      HTTP_SELECTOR,
      new HttpCompletionProvider(variableResolver),
      "{{",
      ":",
      " ",
    ),
    vscode.languages.registerHoverProvider(
      HTTP_SELECTOR,
      new HttpHoverProvider(variableResolver),
    ),
    vscode.languages.registerDocumentLinkProvider(
      HTTP_SELECTOR,
      new HttpDocumentLinkProvider(),
    ),
    diagnosticsProvider,
  );

  // --- Commands ---
  registerCommands(context, {
    panelManager,
    collectionTreeProvider,
    historyTreeProvider,
    workspaceStorage,
    secretStorage,
    httpEngine,
    variableResolver,
    authService,
    scriptRunner,
    outputChannel,
  });

  // --- File Watchers ---
  if (vscode.workspace.workspaceFolders?.[0]) {
    const kobeanrestDir = vscode.Uri.joinPath(
      vscode.workspace.workspaceFolders[0].uri,
      ".kobeanrest",
    );
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(kobeanrestDir, "**/*.json"),
    );
    watcher.onDidChange(() => {
      collectionTreeProvider.refresh();
      environmentTreeProvider.refresh();
      historyTreeProvider.refresh();
    });
    watcher.onDidCreate(() => {
      collectionTreeProvider.refresh();
      environmentTreeProvider.refresh();
      historyTreeProvider.refresh();
    });
    watcher.onDidDelete(() => {
      collectionTreeProvider.refresh();
      environmentTreeProvider.refresh();
      historyTreeProvider.refresh();
    });
    context.subscriptions.push(watcher);
  }

  outputChannel.appendLine("KobeanREST extension activated successfully.");
}

export function deactivate(): void {
  // Cleanup handled by VS Code disposable subscriptions
}
