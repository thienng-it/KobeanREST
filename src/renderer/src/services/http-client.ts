import { invoke } from "@tauri-apps/api/core";
import type { ExecuteHttpRequest, ExecuteHttpResponse } from "../types";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export async function executeHttpRequest(
  request: ExecuteHttpRequest,
): Promise<ExecuteHttpResponse> {
  if (window.__TAURI_INTERNALS__) {
    return invoke<ExecuteHttpResponse>("execute_http_request", { input: request });
  }

  return createPreviewResponse(request);
}

export function createPreviewResponse(request: ExecuteHttpRequest): ExecuteHttpResponse {
  const bodyText = JSON.stringify(
    {
      status: "preview",
      method: request.method,
      url: request.url,
      timeoutMs: request.timeoutMs,
      followRedirects: request.followRedirects,
      source: "browser preview fallback",
    },
    null,
    2,
  );

  return {
    status: 200,
    statusText: "Preview OK",
    headers: [
      {
        key: "content-type",
        value: "application/json",
        enabled: true,
      },
    ],
    bodyText,
    durationMs: 12,
    sizeBytes: new TextEncoder().encode(bodyText).length,
    contentType: "application/json",
  };
}
