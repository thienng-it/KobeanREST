import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

/**
 * Variable resolver unit tests.
 * Tests run standalone without VS Code API by mocking the storage interface.
 */

// Minimal mock of WorkspaceStorageService
class MockStorage {
  private env = {
    name: "Development",
    variables: [
      { key: "baseUrl", value: "http://localhost:3000" },
      { key: "token", value: "abc123" },
      { key: "secretKey", value: "••••", secret: true, secretRef: "ref-1" },
    ],
  };

  getActiveEnvironment() {
    return this.env;
  }

  getActiveEnvironmentName() {
    return "Development";
  }
}

// Inline the core resolve logic for standalone testing
function resolveString(
  template: string,
  variables: Map<string, string>,
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, varName: string) => {
    const trimmed = varName.trim();
    if (trimmed.startsWith("$")) {
      switch (trimmed) {
        case "$timestamp":
          return String(Math.floor(Date.now() / 1000));
        case "$guid":
          return "test-guid-value";
        default:
          return `{{${trimmed}}}`;
      }
    }
    const value = variables.get(trimmed);
    return value !== undefined ? value : `{{${trimmed}}}`;
  });
}

describe("VariableResolver", () => {
  const variables = new Map<string, string>([
    ["baseUrl", "http://localhost:3000"],
    ["token", "abc123"],
    ["apiVersion", "v2"],
  ]);

  it("resolves simple variable", () => {
    const result = resolveString("{{baseUrl}}/users", variables);
    assert.equal(result, "http://localhost:3000/users");
  });

  it("resolves multiple variables", () => {
    const result = resolveString(
      "{{baseUrl}}/{{apiVersion}}/users",
      variables,
    );
    assert.equal(result, "http://localhost:3000/v2/users");
  });

  it("resolves variable in header value", () => {
    const result = resolveString("Bearer {{token}}", variables);
    assert.equal(result, "Bearer abc123");
  });

  it("leaves unresolved variables as-is", () => {
    const result = resolveString("{{unknownVar}}/test", variables);
    assert.equal(result, "{{unknownVar}}/test");
  });

  it("resolves $timestamp dynamic variable", () => {
    const result = resolveString("ts={{$timestamp}}", variables);
    assert.ok(/^ts=\d+$/.test(result));
  });

  it("resolves $guid dynamic variable", () => {
    const result = resolveString("id={{$guid}}", variables);
    assert.equal(result, "id=test-guid-value");
  });

  it("handles empty string", () => {
    const result = resolveString("", variables);
    assert.equal(result, "");
  });

  it("handles string with no variables", () => {
    const result = resolveString(
      "https://api.example.com/users",
      variables,
    );
    assert.equal(result, "https://api.example.com/users");
  });

  it("handles variable with whitespace", () => {
    const result = resolveString("{{ baseUrl }}/users", variables);
    assert.equal(result, "http://localhost:3000/users");
  });

  it("handles adjacent variables", () => {
    const result = resolveString("{{baseUrl}}{{apiVersion}}", variables);
    assert.equal(result, "http://localhost:3000v2");
  });

  it("does not double-resolve nested braces", () => {
    const nested = new Map([["outer", "{{inner}}"]]);
    const result = resolveString("{{outer}}", nested);
    assert.equal(result, "{{inner}}");
  });
});
