import { invoke } from "@tauri-apps/api/core";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export interface StoreSecretInput {
  scope: string;
  key: string;
  value: string;
}

export interface SecretReference {
  refId: string;
}

function isTauriRuntime() {
  return Boolean(window.__TAURI_INTERNALS__);
}

function previewSecretRef(input: StoreSecretInput) {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return `kobeanrest://secrets/${normalize(input.scope)}/${normalize(input.key)}`;
}

export async function storeSecret(input: StoreSecretInput): Promise<SecretReference> {
  if (!isTauriRuntime()) {
    return { refId: previewSecretRef(input) };
  }

  return invoke<SecretReference>("store_secret", { input });
}

export async function deleteSecret(refId: string): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  return invoke<void>("delete_secret", { refId });
}
