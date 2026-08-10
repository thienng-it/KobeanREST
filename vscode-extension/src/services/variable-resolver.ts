import * as crypto from "node:crypto";
import type { WorkspaceStorageService } from "./workspace-storage.js";

/**
 * Resolves {{variableName}} references from the active environment.
 * Supports dynamic variables like {{$timestamp}}, {{$guid}}, {{$randomInt}}.
 */
export class VariableResolver {
  constructor(private readonly storage: WorkspaceStorageService) {}

  getActiveVariableMap(): Map<string, string> {
    const env = this.storage.getActiveEnvironment();
    const map = new Map<string, string>();
    if (env) {
      for (const v of env.variables) {
        if (!v.secret) {
          map.set(v.key, v.value);
        }
      }
    }
    return map;
  }

  resolveString(
    template: string,
    variables: Map<string, string>,
  ): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_match, varName: string) => {
      const trimmed = varName.trim();

      // Dynamic system variables
      if (trimmed.startsWith("$")) {
        return this.resolveDynamicVariable(trimmed);
      }

      // Response references: {{requestName.response.body.field}}
      if (trimmed.includes(".response.")) {
        // Not yet implemented in extension — pass through
        return `{{${trimmed}}}`;
      }

      const value = variables.get(trimmed);
      if (value !== undefined) {
        return value;
      }

      // Unresolved — return as-is (diagnostics will warn)
      return `{{${trimmed}}}`;
    });
  }

  private resolveDynamicVariable(name: string): string {
    switch (name) {
      case "$timestamp":
        return String(Math.floor(Date.now() / 1000));
      case "$isoTimestamp":
        return new Date().toISOString();
      case "$guid":
      case "$uuid":
        return crypto.randomUUID();
      case "$randomInt":
        return String(Math.floor(Math.random() * 1000));
      case "$randomEmail":
        return `user${Math.floor(Math.random() * 10000)}@example.com`;
      case "$randomString":
        return crypto.randomBytes(8).toString("hex");
      case "$randomBoolean":
        return String(Math.random() > 0.5);
      default:
        return `{{${name}}}`;
    }
  }

  /** Returns all known variable names for IntelliSense completions. */
  getAvailableVariableNames(): string[] {
    const env = this.storage.getActiveEnvironment();
    const names = env?.variables.map((v) => v.key) ?? [];

    // Add dynamic variables
    names.push(
      "$timestamp",
      "$isoTimestamp",
      "$guid",
      "$uuid",
      "$randomInt",
      "$randomEmail",
      "$randomString",
      "$randomBoolean",
    );

    return names;
  }

  /** Get the current value of a variable for hover preview. */
  getVariableValue(name: string): string | undefined {
    if (name.startsWith("$")) {
      return this.resolveDynamicVariable(name);
    }
    const env = this.storage.getActiveEnvironment();
    const v = env?.variables.find((variable) => variable.key === name);
    if (v?.secret) {
      return "••••••••";
    }
    return v?.value;
  }
}
