import type { ExecuteHttpResponse } from "./types";

export type ResponseState =
  | { kind: "idle"; response?: ExecuteHttpResponse }
  | { kind: "loading"; response?: ExecuteHttpResponse }
  | { kind: "success"; response: ExecuteHttpResponse }
  | { kind: "error"; message: string };

export function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  return `${(sizeBytes / 1024).toFixed(1)} KB`;
}

export function statusColor(status: number): string {
  if (status >= 500) return 'var(--color-status-5xx)';
  if (status >= 400) return 'var(--color-status-4xx)';
  if (status >= 300) return 'var(--color-status-3xx)';
  if (status >= 200) return 'var(--color-status-2xx)';
  return 'var(--color-status-1xx)';
}

/** Muted status color (history rows, secondary status text). */
export const statusColorMuted = 'var(--color-status-muted)';
