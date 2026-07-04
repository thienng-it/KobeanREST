import { check, type Update } from "@tauri-apps/plugin-updater";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export interface AvailableUpdate {
  currentVersion: string;
  version: string;
  date?: string;
  body?: string;
  signatureVerified: boolean;
  update: Update;
}

function formatDownloadBytes(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  return `${(sizeBytes / 1024).toFixed(1)} KB`;
}

export async function checkForAppUpdate(): Promise<AvailableUpdate | null> {
  if (!window.__TAURI_INTERNALS__) {
    return null;
  }

  const update = await check({ timeout: 4000 });
  if (!update) {
    return null;
  }

  return {
    currentVersion: update.currentVersion,
    version: update.version,
    date: update.date,
    body: update.body,
    signatureVerified: true,
    update,
  };
}

export async function downloadAndInstallUpdate(
  availableUpdate: AvailableUpdate,
  onProgress?: (label: string) => void,
): Promise<void> {
  const update = availableUpdate.update;
  let contentLength = 0;
  let downloadedBytes = 0;

  await update.downloadAndInstall((event) => {
    if (event.event === "Started") {
      contentLength = event.data.contentLength ?? 0;
      onProgress?.("Downloading update...");
      return;
    }

    if (event.event === "Progress") {
      downloadedBytes += event.data.chunkLength;
      if (contentLength > 0) {
        const percent = Math.min(99, Math.round((downloadedBytes / contentLength) * 100));
        onProgress?.(`Downloading update... ${percent}%`);
      } else {
        onProgress?.(`Downloading update... ${formatDownloadBytes(downloadedBytes)}`);
      }
      return;
    }

    onProgress?.("Installing update...");
  });

  onProgress?.("Restart to finish update install.");
}
