import * as vscode from "vscode";
import type {
  WorkspaceStorageService,
  StoredHistoryEntry,
} from "../services/workspace-storage.js";

class HistoryGroupItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly entries: StoredHistoryEntry[],
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon("history");
    this.description = `${entries.length} requests`;
  }
}

class HistoryEntryItem extends vscode.TreeItem {
  constructor(public readonly entry: StoredHistoryEntry) {
    super(
      `${entry.method} ${entry.url}`,
      vscode.TreeItemCollapsibleState.None,
    );

    const statusIcon =
      entry.status >= 200 && entry.status < 300
        ? "$(pass)"
        : entry.status >= 400
          ? "$(error)"
          : "$(warning)";

    this.description = `${statusIcon} ${entry.status} · ${entry.durationMs}ms`;
    this.tooltip = new vscode.MarkdownString(
      `**${entry.method}** \`${entry.url}\`\n\n` +
        `Status: ${entry.status}\n` +
        `Duration: ${entry.durationMs}ms\n` +
        `Size: ${formatBytes(entry.sizeBytes)}\n` +
        `Time: ${new Date(entry.createdAt).toLocaleString()}`,
    );

    this.iconPath = new vscode.ThemeIcon(
      entry.status >= 200 && entry.status < 300
        ? "check"
        : entry.status >= 400
          ? "close"
          : "warning",
      new vscode.ThemeColor(
        entry.status >= 200 && entry.status < 300
          ? "charts.green"
          : entry.status >= 400
            ? "charts.red"
            : "charts.yellow",
      ),
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function groupByDate(
  entries: StoredHistoryEntry[],
): Map<string, StoredHistoryEntry[]> {
  const groups = new Map<string, StoredHistoryEntry[]>();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  for (const entry of entries) {
    const entryDate = new Date(entry.createdAt);
    let group: string;
    if (entryDate >= today) {
      group = "Today";
    } else if (entryDate >= yesterday) {
      group = "Yesterday";
    } else if (entryDate >= weekAgo) {
      group = "This Week";
    } else {
      group = "Older";
    }

    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)!.push(entry);
  }

  return groups;
}

/**
 * Tree data provider for request history, grouped by date.
 */
export class HistoryTreeProvider
  implements vscode.TreeDataProvider<HistoryGroupItem | HistoryEntryItem>
{
  private onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    HistoryGroupItem | HistoryEntryItem | undefined
  >();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly storage: WorkspaceStorageService) {}

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  getTreeItem(
    element: HistoryGroupItem | HistoryEntryItem,
  ): vscode.TreeItem {
    return element;
  }

  getChildren(
    element?: HistoryGroupItem | HistoryEntryItem,
  ): (HistoryGroupItem | HistoryEntryItem)[] {
    if (!element) {
      const history = this.storage.getHistory();
      if (history.length === 0) {
        return [];
      }

      const groups = groupByDate(history);
      const items: HistoryGroupItem[] = [];
      const order = ["Today", "Yesterday", "This Week", "Older"];
      for (const name of order) {
        const entries = groups.get(name);
        if (entries?.length) {
          items.push(new HistoryGroupItem(name, entries));
        }
      }
      return items;
    }

    if (element instanceof HistoryGroupItem) {
      return element.entries.map((e) => new HistoryEntryItem(e));
    }

    return [];
  }
}
