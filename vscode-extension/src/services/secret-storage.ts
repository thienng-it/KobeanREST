import * as vscode from "vscode";

/**
 * Wraps VS Code's SecretStorage API to match KobeanREST's secret boundary.
 * Secrets are stored in the OS keychain (macOS Keychain, Windows Credential Manager, etc.)
 * and never in plain-text workspace files.
 */
export class SecretStorageService {
  private readonly secrets: vscode.SecretStorage;
  private readonly onDidChangeEmitter = new vscode.EventEmitter<string>();
  public readonly onDidChange = this.onDidChangeEmitter.event;

  constructor(context: vscode.ExtensionContext) {
    this.secrets = context.secrets;
    context.subscriptions.push(
      this.secrets.onDidChange((e) => {
        this.onDidChangeEmitter.fire(e.key);
      }),
    );
  }

  async store(key: string, value: string): Promise<void> {
    await this.secrets.store(`kobeanrest.${key}`, value);
  }

  async get(key: string): Promise<string | undefined> {
    return this.secrets.get(`kobeanrest.${key}`);
  }

  async delete(key: string): Promise<void> {
    await this.secrets.delete(`kobeanrest.${key}`);
  }

  /** Checks if a secret exists without retrieving its value. */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== undefined;
  }
}
