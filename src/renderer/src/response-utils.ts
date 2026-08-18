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

export type PreviewMode = "rendered" | "xml" | "html" | "json" | "graphql" | "raw";

export interface GraphQLResponseSummary {
  isGraphQL: boolean;
  hasData: boolean;
  hasErrors: boolean;
  errorCount: number;
  dataKeys: string[];
  firstErrorMessage?: string;
}

export function analyzeGraphQLResponse(
  body?: string | null,
  contentType?: string | null,
  isExplicitGraphQLRequest?: boolean
): GraphQLResponseSummary | null {
  if (!body || !body.trim()) return null;
  const isGqlMime = (contentType || "").toLowerCase().includes("graphql");

  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const keys = Object.keys(parsed);
      const isSpecCompliantGqlKeys =
        keys.length > 0 &&
        keys.every((k) => k === "data" || k === "errors" || k === "extensions");

      const hasDataKey = "data" in parsed;
      // In GraphQL spec, 'data' is always a map/object (e.g. { user: ... }) or null. It is NEVER a JSON array like [ ... ].
      const isGqlDataStructure =
        hasDataKey &&
        (parsed.data === null ||
          (typeof parsed.data === "object" && !Array.isArray(parsed.data)));

      const hasErrorsKey = "errors" in parsed;
      // In GraphQL spec, 'errors' is an array of error objects.
      const isGqlErrorsStructure =
        hasErrorsKey &&
        Array.isArray(parsed.errors) &&
        (parsed.errors.length === 0 ||
          typeof parsed.errors[0] === "object" ||
          typeof parsed.errors[0] === "string");

      const isGraphQL =
        isExplicitGraphQLRequest ||
        isGqlMime ||
        (isSpecCompliantGqlKeys && (isGqlDataStructure || isGqlErrorsStructure));

      if (isGraphQL && (hasDataKey || hasErrorsKey || isGqlMime || isExplicitGraphQLRequest)) {
        const hasData = hasDataKey && parsed.data !== null && parsed.data !== undefined;
        const hasErrors = isGqlErrorsStructure && parsed.errors.length > 0;
        const dataKeys =
          hasData && typeof parsed.data === "object" && !Array.isArray(parsed.data) && parsed.data
            ? Object.keys(parsed.data)
            : [];
        const errorCount = hasErrors ? parsed.errors.length : 0;
        const firstErrorMessage = hasErrors
          ? parsed.errors[0]?.message || String(parsed.errors[0])
          : undefined;

        return {
          isGraphQL: true,
          hasData,
          hasErrors,
          errorCount,
          dataKeys,
          firstErrorMessage,
        };
      }
    }
  } catch {
    // Not valid JSON
  }
  return null;
}

export function formatResponseBody(body: string, mode: PreviewMode): string {
  if (!body) return body;
  
  if (mode === "json" || mode === "graphql") {
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
