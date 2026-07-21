import { PRODUCT_DOCS_URL } from "./product-contract";
import { redactDiagnosticError } from "./services/redaction";
import type { EnvironmentVariable, SavedRequest, WorkspaceSummary } from "./types";

export function formatTimestamp(createdAt: string): string {
  try {
    return new Date(createdAt.replace(' ', 'T') + 'Z').toLocaleString();
  } catch {
    return createdAt;
  }
}

export function openProductDocs() {
  const popup = window.open(PRODUCT_DOCS_URL, "_blank", "noopener,noreferrer");
  if (!popup) {
    window.location.assign(PRODUCT_DOCS_URL);
  }
}

export function createScriptVariablesObject(variables: EnvironmentVariable[]): Record<string, string> {
  return Object.fromEntries(
    variables
      .filter((variable) => !(variable.secret && variable.secretRef))
      .map((variable) => [variable.key, variable.value]),
  );
}

export function formatScriptLogValue(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function getEffectiveAuth(request: SavedRequest, workspace: WorkspaceSummary | null) {
  if (!workspace) {
    return { mode: "none" as const, config: {}, source: "No workspace loaded" };
  }

  if (request.authMode !== "none") {
    return { mode: request.authMode, config: request.authConfig, source: "Request level" };
  }

  const folder = workspace?.folders.find((item) => item.id === request.folderId);
  if (folder?.authMode && folder.authMode !== "none") {
    return { mode: folder.authMode, config: folder.authConfig ?? {}, source: `Inherited from folder: ${folder.name}` };
  }

  const collection = workspace?.collections?.find((item) => folder?.collectionId === item.id);
  if (collection?.authMode && collection.authMode !== "none") {
    return { mode: collection.authMode, config: collection.authConfig ?? {}, source: `Inherited from collection: ${collection.name}` };
  }

  return { mode: "none" as const, config: {}, source: "No inherited auth" };
}

export function diagnosticMessage(error: unknown): string {
  return redactDiagnosticError(error);
}
