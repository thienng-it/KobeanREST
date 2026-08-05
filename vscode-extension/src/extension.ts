import * as vscode from 'vscode';
import { KobeanWebviewProvider } from './KobeanWebviewProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('KobeanREST VS Code Extension activated.');

  const sidebarProvider = new KobeanWebviewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      KobeanWebviewProvider.viewType,
      sidebarProvider
    )
  );

  const openCommand = vscode.commands.registerCommand('kobeanrest.open', () => {
    KobeanWebviewProvider.createOrShowPanel(context.extensionUri);
  });

  const openSidebarCommand = vscode.commands.registerCommand('kobeanrest.openSidebar', () => {
    vscode.commands.executeCommand('workbench.view.extension.kobeanrest-sidebar-view-container');
  });

  context.subscriptions.push(openCommand, openSidebarCommand);
}

export function deactivate() {}
