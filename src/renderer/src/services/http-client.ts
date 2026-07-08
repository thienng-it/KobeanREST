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

  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), request.timeoutMs);

    const response = await fetch(request.url, {
      method: request.method === "CUSTOM" ? "GET" : request.method, // fetch doesn't support all custom methods
      headers: Object.fromEntries(
        request.headers
          .filter(h => h.enabled)
          .map(h => [h.key, h.value])
      ),
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
      signal: controller.signal,
      redirect: request.followRedirects ? "follow" : "manual",
    });

    clearTimeout(timeoutId);
    const bodyText = await response.text();
    const durationMs = Math.round(performance.now() - start);

    return {
      status: response.status,
      statusText: response.statusText,
      headers: Array.from(response.headers.entries()).map(([key, value]) => ({
        key,
        value,
        enabled: true,
      })),
      bodyText,
      durationMs,
      sizeBytes: new TextEncoder().encode(bodyText).length,
      contentType: response.headers.get("content-type"),
    };
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error(`Request timed out after ${request.timeoutMs}ms`);
    }
    throw error;
  }
}
