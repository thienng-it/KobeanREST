import { PRODUCT_DOCS_URL } from "./product-contract";
import { redactDiagnosticError } from "./services/redaction";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import type { EnvironmentVariable } from "./types";

export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return ["token", "bearer", "password", "secret", "sensitive", "api_key", "apikey", "auth"].some(k => normalized.includes(k));
}

export function formatTimestamp(createdAt: string): string {
  if (!createdAt) return "";
  const directDate = new Date(createdAt);
  if (!isNaN(directDate.getTime())) {
    return directDate.toLocaleString();
  }
  const normalized = createdAt.replace(" ", "T");
  const withZ = normalized.endsWith("Z") || normalized.includes("+") ? normalized : `${normalized}Z`;
  const fallbackDate = new Date(withZ);
  if (!isNaN(fallbackDate.getTime())) {
    return fallbackDate.toLocaleString();
  }
  return createdAt;
}

export function openProductDocs() {
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    openUrl(PRODUCT_DOCS_URL).catch((err: unknown) => {
      console.error("Failed to open docs using Tauri shell:", err);
      window.open(PRODUCT_DOCS_URL, "_blank", "noopener,noreferrer");
    });
  } else {
    const popup = window.open(PRODUCT_DOCS_URL, "_blank", "noopener,noreferrer");
    if (!popup) {
      window.location.assign(PRODUCT_DOCS_URL);
    }
  }
}

export function createScriptVariablesObject(variables: EnvironmentVariable[]): Record<string, string> {
  return Object.fromEntries(
    variables
      .map((variable) => [variable.key, variable.value]),
  );
}

export function formatScriptLogValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) {
    return value.stack ? `${value.name}: ${value.message}\n${value.stack}` : `${value.name}: ${value.message}`;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function diagnosticMessage(error: unknown): string {
  return redactDiagnosticError(error);
}
