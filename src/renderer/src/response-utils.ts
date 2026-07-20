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
  if (status >= 500) return '#991b1b';
  if (status >= 400) return '#92400e';
  if (status >= 300) return '#1e40af';
  if (status >= 200) return '#14532d';
  return '#334155';
}
