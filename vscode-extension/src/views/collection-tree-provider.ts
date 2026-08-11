import * as vscode from "vscode";
import type {
  WorkspaceStorageService,
  StoredCollection,
  StoredFolder,
  StoredRequest,
} from "../services/workspace-storage.js";

type TreeItem = CollectionItem | FolderItem | RequestItem;

class CollectionItem extends vscode.TreeItem {
  constructor(public readonly collection: StoredCollection) {
    super(collection.name, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = "collection";
    this.iconPath = new vscode.ThemeIcon("folder-library");
    this.tooltip = `${collection.name} (${collection.requests.length + collection.folders.reduce((s, f) => s + f.requests.length, 0)} requests)`;
  }
}

class FolderItem extends vscode.TreeItem {
  constructor(public readonly folder: StoredFolder) {
    super(folder.name, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = "folder";
    this.iconPath = new vscode.ThemeIcon("folder");
    this.tooltip = `${folder.name} (${folder.requests.length} requests)`;
  }
}

const METHOD_COLORS: Record<string, string> = {
  GET: "charts.green",
  POST: "charts.yellow",
  PUT: "charts.blue",
  PATCH: "charts.orange",
  DELETE: "charts.red",
  HEAD: "charts.purple",
  OPTIONS: "charts.purple",
};

class RequestItem extends vscode.TreeItem {
  constructor(public readonly request: StoredRequest) {
    super(
      `${request.method} ${request.name || request.url}`,
      vscode.TreeItemCollapsibleState.None,
    );
    this.contextValue = "request";

    // Method-colored icon
    const iconId =
      request.method === "GET"
        ? "arrow-down"
        : request.method === "POST"
          ? "arrow-up"
          : request.method === "DELETE"
            ? "trash"
            : "arrow-both";
    this.iconPath = new vscode.ThemeIcon(
      iconId,
      new vscode.ThemeColor(METHOD_COLORS[request.method] ?? "foreground"),
    );

    // Status badge
    const statusBadge =
      request.lastStatus
        ? ` [${request.lastStatus} · ${request.lastDurationMs}ms]`
        : "";
    this.description = request.url.replace(/^https?:\/\/[^/]+/, "") + statusBadge;

    this.tooltip = new vscode.MarkdownString(
      `**${request.method}** \`${request.url}\`${request.lastStatus ? `\n\nLast: ${request.lastStatus} (${request.lastDurationMs}ms)` : ""}`,
    );

    this.command = {
      command: "kobeanrest.sendRequest",
      title: "Send Request",
      arguments: [request],
    };
  }
}

/**
 * Tree data provider for the Collections sidebar view.
 * Shows collections → folders → requests hierarchy with method-colored icons
 * and last response status badges.
 */
export class CollectionTreeProvider
  implements vscode.TreeDataProvider<TreeItem>
{
  private onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    TreeItem | undefined
  >();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly storage: WorkspaceStorageService) {}

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeItem): TreeItem[] {
    if (!element) {
      // Root: show collections
      return this.storage
        .getCollections()
        .map((c) => new CollectionItem(c));
    }

    if (element instanceof CollectionItem) {
      const col = element.collection;
      const children: TreeItem[] = [];
      for (const folder of col.folders) {
        children.push(new FolderItem(folder));
      }
      for (const req of col.requests) {
        children.push(new RequestItem(req));
      }
      return children;
    }

    if (element instanceof FolderItem) {
      return element.folder.requests.map((r) => new RequestItem(r));
    }

    return [];
  }
}
