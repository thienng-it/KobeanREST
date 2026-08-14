import { invoke } from "@tauri-apps/api/core";
import type { ExecuteHttpRequest, ExecuteHttpResponse } from "../types";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

function createPreviewResponse(
  status: number,
  statusText: string,
  headers: Headers,
  bodyText: string,
  durationMs: number,
): ExecuteHttpResponse {
  return {
    status,
    statusText,
    headers: Array.from(headers.entries()).map(([key, value]) => ({
      key,
      value,
      enabled: true,
    })),
    bodyText,
    durationMs,
    dnsMs: 0,
    connectMs: 0,
    tlsMs: 0,
    requestMs: 0,
    sizeBytes: new TextEncoder().encode(bodyText).length,
    contentType: headers.get("content-type"),
  };
}

export async function executeHttpRequest(
  request: ExecuteHttpRequest,
): Promise<ExecuteHttpResponse> {
  if (window.__TAURI_INTERNALS__) {
    return invoke<ExecuteHttpResponse>("execute_http_request", { input: request });
  }

  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), request.timeoutMs);

    const headersObj = Object.fromEntries(
      request.headers
        .filter(h => h.enabled)
        .map(h => [h.key, h.value])
    );

    // If bodyMimeType is provided and Content-Type is not explicitly set in headers, add it.
    if (request.bodyMimeType && !headersObj["Content-Type"] && !headersObj["content-type"]) {
      headersObj["Content-Type"] = request.bodyMimeType;
    }

    let body: BodyInit | undefined = undefined;
    if (request.method !== "GET" && request.method !== "HEAD") {
      if (request.bodyMimeType === "application/x-www-form-urlencoded" && request.bodyForm && request.bodyForm.length > 0) {
        const params = new URLSearchParams();
        request.bodyForm.forEach(item => {
          if (item.enabled && item.key) {
            params.append(item.key, item.value);
          }
        });
        body = params.toString();
      } else if (request.bodyMimeType === "application/octet-stream" && request.body) {
        let base64Data: string | null = null;
        try {
          const parsed = JSON.parse(request.body);
          if (parsed && typeof parsed === "object" && typeof parsed.base64 === "string") {
            base64Data = parsed.base64;
          }
        } catch {
          if (request.body.startsWith("data:")) {
            const commaIdx = request.body.indexOf(",");
            if (commaIdx !== -1) {
              base64Data = request.body.substring(commaIdx + 1);
            }
          }
        }

        if (base64Data) {
          try {
            const binStr = atob(base64Data.trim());
            const len = binStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binStr.charCodeAt(i);
            }
            body = bytes;
          } catch {
            body = request.body;
          }
        } else {
          body = request.body;
        }
      } else {
        body = request.body;
      }
    }

    const response = await fetch(request.url, {
      method: request.method === "CUSTOM" ? "GET" : request.method, // fetch doesn't support all custom methods
      headers: headersObj,
      body: body,
      signal: controller.signal,
      redirect: request.followRedirects ? "follow" : "manual",
    });

    clearTimeout(timeoutId);
    const bodyText = await response.text();
    const durationMs = Math.round(performance.now() - start);

    return createPreviewResponse(
      response.status,
      response.statusText,
      response.headers,
      bodyText,
      durationMs,
    );
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error(`Request timed out after ${request.timeoutMs}ms`);
    }
    throw error;
  }
}
