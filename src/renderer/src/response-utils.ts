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

export type PreviewMode = "rendered" | "xml" | "html" | "json" | "raw";

export function formatResponseBody(body: string, mode: PreviewMode): string {
  if (!body) return body;
  
  if (mode === "json") {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }
  
  if (mode === "xml" || mode === "html" || mode === "rendered") {
    try {
      let formatted = '';
      let pad = 0;
      const xml = body.replace(/(>)(<)(\/*)/g, '$1\n$2$3');
      const lines = xml.split('\n');
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (line.match(/^<\/\w/)) {
          pad -= 1;
        }
        formatted += '  '.repeat(Math.max(0, pad)) + line + '\n';
        if (line.match(/^<\w[^>]*[^\/]>.*$/) && !line.match(/^<\w[^>]*[^\/]>.*<\/\w[^>]*>$/)) {
          pad += 1;
        }
      }
      return formatted.trim();
    } catch {
      return body;
    }
  }
  
  return body;
}
