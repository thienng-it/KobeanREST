import type { GrpcCallResult, GrpcStreamMessage, ExecuteHttpRequest } from '../types';
import { executeHttpRequest } from './http-client';

export interface GrpcCallOptions {
  url: string;
  service: string;
  method: string;
  payloadJson: string;
  metadata?: Array<{ key: string; value: string; enabled?: boolean }>;
  useTls?: boolean;
  timeoutMs?: number;
  onStreamMessage?: (msg: GrpcStreamMessage) => void;
  signal?: AbortSignal;
}

export const GRPC_STATUS_MAP: Record<number, { code: string; description: string }> = {
  0: { code: "OK", description: "Operation succeeded" },
  1: { code: "CANCELLED", description: "Operation was cancelled by caller" },
  2: { code: "UNKNOWN", description: "Unknown error occurred" },
  3: { code: "INVALID_ARGUMENT", description: "Client specified an invalid argument" },
  4: { code: "DEADLINE_EXCEEDED", description: "Deadline expired before operation could complete" },
  5: { code: "NOT_FOUND", description: "Requested entity was not found" },
  6: { code: "ALREADY_EXISTS", description: "Entity that a client attempted to create already exists" },
  7: { code: "PERMISSION_DENIED", description: "Caller does not have permission to execute the specified operation" },
  8: { code: "RESOURCE_EXHAUSTED", description: "Resource quota has been exhausted" },
  9: { code: "FAILED_PRECONDITION", description: "Operation was rejected because the system is not in a state required for execution" },
  10: { code: "ABORTED", description: "Operation was aborted" },
  11: { code: "OUT_OF_RANGE", description: "Operation was attempted past the valid range" },
  12: { code: "UNIMPLEMENTED", description: "Operation is not implemented or not supported/enabled" },
  13: { code: "INTERNAL", description: "Internal errors" },
  14: { code: "UNAVAILABLE", description: "Service is currently unavailable" },
  15: { code: "DATA_LOSS", description: "Unrecoverable data loss or corruption" },
  16: { code: "UNAUTHENTICATED", description: "Request does not have valid authentication credentials" },
};

export async function executeGrpcCall(options: GrpcCallOptions): Promise<GrpcCallResult> {
  const startTime = performance.now();
  let normalizedUrl = options.url.trim();

  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = (options.useTls ? 'https://' : 'http://') + normalizedUrl;
  }

  // Build full RPC path (e.g. /helloworld.Greeter/SayHello)
  const servicePath = options.service.replace(/^\/+/, '');
  const methodName = options.method.replace(/^\/+/, '');
  const rpcPath = `/${servicePath}/${methodName}`;
  
  let targetEndpoint: string;
  try {
    const parsed = new URL(normalizedUrl);
    if (parsed.pathname && parsed.pathname !== '/' && (parsed.pathname.includes(servicePath) || parsed.pathname.endsWith(methodName))) {
      targetEndpoint = normalizedUrl;
    } else {
      targetEndpoint = `${parsed.origin}${rpcPath}`;
    }
  } catch {
    targetEndpoint = `${normalizedUrl.replace(/\/+$/, '')}${rpcPath}`;
  }

  const streamMessages: GrpcStreamMessage[] = [];

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, application/grpc-web+proto, text/plain',
    'X-Grpc-Web': '1',
    'X-User-Agent': 'KobeanREST-gRPC/1.0',
  };

  if (options.metadata) {
    for (const item of options.metadata) {
      if (item.enabled !== false && item.key.trim() && item.value.trim()) {
        headers[item.key.trim()] = item.value.trim();
      }
    }
  }

  // Record outgoing message packet
  const outgoingPacket: GrpcStreamMessage = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    direction: 'outgoing',
    data: options.payloadJson,
    size: new Blob([options.payloadJson]).size,
  };
  streamMessages.push(outgoingPacket);
  options.onStreamMessage?.(outgoingPacket);

  try {
    let statusCode = 0;
    let statusText = 'OK';
    let durationMs = 0;
    let rawResponseBody = '';
    const responseHeaders: Array<{ key: string; value: string }> = [];
    const responseTrailers: Array<{ key: string; value: string }> = [];

    // 1. If running inside Tauri native runtime, dispatch through native reqwest (bypasses browser CORS & WKWebView sandboxes)
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      const nativeReq: ExecuteHttpRequest = {
        method: 'POST',
        url: targetEndpoint,
        headers: Object.entries(headers).map(([key, value]) => ({ key, value, enabled: true })),
        body: options.payloadJson,
        bodyMimeType: 'application/json',
        timeoutMs: options.timeoutMs || 30000,
        followRedirects: true,
      };

      const nativeRes = await executeHttpRequest(nativeReq);
      durationMs = nativeRes.durationMs;
      rawResponseBody = nativeRes.bodyText || '';

      for (const h of nativeRes.headers) {
        responseHeaders.push({ key: h.key, value: h.value });
      }

      const grpcStatusHeader = nativeRes.headers.find(
        (h) => h.key.toLowerCase() === 'grpc-status' || h.key.toLowerCase() === 'x-grpc-status'
      )?.value;
      const grpcMessageHeader = nativeRes.headers.find(
        (h) => h.key.toLowerCase() === 'grpc-message' || h.key.toLowerCase() === 'x-grpc-message'
      )?.value;

      statusCode = grpcStatusHeader
        ? parseInt(grpcStatusHeader, 10)
        : nativeRes.status >= 200 && nativeRes.status < 300
        ? 0
        : nativeRes.status === 400
        ? 3
        : nativeRes.status === 404
        ? 5
        : nativeRes.status === 503
        ? 14
        : 2;

      const codeName = GRPC_STATUS_MAP[statusCode]?.code || (nativeRes.status >= 200 && nativeRes.status < 300 ? 'OK' : 'UNKNOWN');
      statusText = codeName;
      if (grpcMessageHeader && grpcMessageHeader.trim() && grpcMessageHeader.trim().toLowerCase() !== codeName.toLowerCase() && grpcMessageHeader.trim().toLowerCase() !== 'ok') {
        statusText = `${codeName} (${grpcMessageHeader.trim()})`;
      }
      if (grpcStatusHeader) {
        responseTrailers.push({ key: 'grpc-status', value: grpcStatusHeader });
      }
    } else {
      // 2. Browser fallback via fetch
      const controller = new AbortController();
      const timeoutId = options.timeoutMs ? setTimeout(() => controller.abort(), options.timeoutMs) : null;

      if (options.signal) {
        options.signal.addEventListener('abort', () => controller.abort());
      }

      const response = await fetch(targetEndpoint, {
        method: 'POST',
        headers,
        body: options.payloadJson,
        signal: controller.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);

      durationMs = Math.round(performance.now() - startTime);

      response.headers.forEach((value, key) => {
        responseHeaders.push({ key, value });
      });

      const grpcStatusHeader = response.headers.get('grpc-status') || response.headers.get('x-grpc-status');
      const grpcMessageHeader = response.headers.get('grpc-message') || response.headers.get('x-grpc-message');

      statusCode = grpcStatusHeader
        ? parseInt(grpcStatusHeader, 10)
        : response.ok
        ? 0
        : response.status === 400
        ? 3
        : response.status === 404
        ? 5
        : response.status === 503
        ? 14
        : 2;

      const codeName = GRPC_STATUS_MAP[statusCode]?.code || (response.ok ? 'OK' : 'UNKNOWN');
      statusText = codeName;
      if (grpcMessageHeader && grpcMessageHeader.trim() && grpcMessageHeader.trim().toLowerCase() !== codeName.toLowerCase() && grpcMessageHeader.trim().toLowerCase() !== 'ok') {
        statusText = `${codeName} (${grpcMessageHeader.trim()})`;
      }
      if (grpcStatusHeader) {
        responseTrailers.push({ key: 'grpc-status', value: grpcStatusHeader });
      }

      rawResponseBody = await response.text();
    }

    let parsedResponse = rawResponseBody;
    try {
      const json = JSON.parse(rawResponseBody);
      parsedResponse = JSON.stringify(json, null, 2);
    } catch {
      // Keep raw string
    }

    const incomingPacket: GrpcStreamMessage = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      direction: 'incoming',
      data: parsedResponse,
      size: new Blob([rawResponseBody]).size,
    };
    streamMessages.push(incomingPacket);
    options.onStreamMessage?.(incomingPacket);

    return {
      status: statusCode,
      statusText: `${statusCode} ${statusText}`,
      durationMs,
      responseBody: parsedResponse,
      responseHeaders,
      responseTrailers,
      streamMessages,
    };
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - startTime);
    const isAborted = err.name === 'AbortError';
    const statusCode = isAborted ? 1 : 14;
    const statusText = isAborted ? '1 CANCELLED' : '14 UNAVAILABLE';

    const errPacket: GrpcStreamMessage = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      direction: 'system',
      data: `gRPC Call Error: ${err?.message || String(err)}`,
      size: 0,
    };
    streamMessages.push(errPacket);
    options.onStreamMessage?.(errPacket);

    return {
      status: statusCode,
      statusText,
      durationMs,
      error: err?.message || String(err),
      streamMessages,
    };
  }
}
