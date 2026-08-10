import * as vscode from "vscode";
import type { WorkspaceStorageService, StoredEnvironment } from "../services/workspace-storage.js";

class EnvironmentItem extends vscode.TreeItem {
  constructor(public readonly env: StoredEnvironment, isActive: boolean) {
    super(env.name, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = "environment";
    this.iconPath = new vscode.ThemeIcon(
      isActive ? "check" : "symbol-variable",
      isActive ? new vscode.ThemeColor("charts.green") : undefined,
    );
    this.description = isActive ? "Active" : "";
    this.tooltip = `${env.name} environment (${env.variables.length} variables)`;

    this.command = {
      command: "kobeanrest.setActiveEnvironment",
      title: "Set Active Environment",
      arguments: [env.name],
    };
  }
}

class VariableItem extends vscode.TreeItem {
  constructor(key: string, value: string, isSecret?: boolean) {
    super(key, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "variable";
    this.description = isSecret ? "•••••••• (Secret)" : value;
    this.iconPath = new vscode.ThemeIcon(isSecret ? "key" : "symbol-value");
    this.tooltip = `${key}: ${isSecret ? "Secret Value" : value}`;
  }
}

/**
 * Tree data provider for Environments sidebar view.
 */
export class EnvironmentTreeProvider implements vscode.TreeDataProvider<EnvironmentItem | VariableItem> {
  private onDidChangeTreeDataEmitter = new vscode.EventEmitter<EnvironmentItem | VariableItem | undefined>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly storage: WorkspaceStorageService) {}

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  getTreeItem(element: EnvironmentItem | VariableItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: EnvironmentItem | VariableItem): (EnvironmentItem | VariableItem)[] {
    if (!element) {
      const environments = this.storage.getEnvironments();
      const activeName = this.storage.getActiveEnvironmentName();
      return environments.map((e) => new EnvironmentItem(e, e.name === activeName));
    }

    if (element instanceof EnvironmentItem) {
      return element.env.variables.map(
        (v) => new VariableItem(v.key, v.value, v.secret),
      );
    }

    return [];
  }
}
