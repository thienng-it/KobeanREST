import * as vscode from "vscode";
import * as https from "node:https";
import * as http from "node:http";
import { URL } from "node:url";

export interface HttpRequest {
  method: string;
  url: string;
  headers: Array<{ key: string; value: string; enabled: boolean }>;
  body?: string;
  bodyMimeType?: string;
  bodyForm?: Array<{ key: string; value: string; enabled: boolean }>;
  timeoutMs: number;
  followRedirects: boolean;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Array<{ key: string; value: string; enabled: boolean }>;
  bodyText?: string;
  bodyBase64?: string;
  durationMs: number;
  dnsMs: number;
  connectMs: number;
  tlsMs: number;
  requestMs: number;
  sizeBytes: number;
  contentType?: string;
}

/**
 * Node.js HTTP engine that mirrors the capabilities of KobeanREST's Rust http_client.rs.
 * Supports HTTP/1.1, timeouts, redirects, proxy, certificate validation toggle,
 * and detailed timing breakdown.
 */
export class HttpEngine {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async execute(request: HttpRequest): Promise<HttpResponse> {
    const config = vscode.workspace.getConfiguration("kobeanrest");
    const validateCerts = config.get<boolean>("validateCertificates") ?? true;
    const proxyUrl = config.get<string>("proxy") ?? "";

    const url = new URL(request.url);
    const isHttps = url.protocol === "https:";
    const transport = isHttps ? https : http;

    const headerObj: Record<string, string> = {};
    for (const h of request.headers) {
      if (h.enabled && h.key) {
        headerObj[h.key] = h.value;
      }
    }

    // Set Content-Type if body exists and not already set
    if (request.bodyMimeType && !headerObj["Content-Type"] && !headerObj["content-type"]) {
      headerObj["Content-Type"] = request.bodyMimeType;
    }

    let body: string | undefined;
    if (request.method !== "GET" && request.method !== "HEAD") {
      if (
        request.bodyMimeType === "application/x-www-form-urlencoded" &&
        request.bodyForm?.length
      ) {
        const params = new URLSearchParams();
        for (const item of request.bodyForm) {
          if (item.enabled && item.key) {
            params.append(item.key, item.value);
          }
        }
        body = params.toString();
      } else {
        body = request.body;
      }
    }

    return new Promise<HttpResponse>((resolve, reject) => {
      const timings = {
        start: performance.now(),
        dns: 0,
        connect: 0,
        tls: 0,
        request: 0,
      };

      const options: http.RequestOptions | https.RequestOptions = {
        method: request.method,
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        headers: headerObj,
        timeout: request.timeoutMs,
        ...(isHttps ? { rejectUnauthorized: validateCerts } : {}),
      };

      const req = transport.request(options, (res) => {
        timings.request = performance.now();

        // Handle redirects
        if (
          request.followRedirects &&
          res.statusCode &&
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location
        ) {
          const redirectUrl = new URL(res.headers.location, request.url);
          this.execute({
            ...request,
            url: redirectUrl.toString(),
          })
            .then(resolve)
            .catch(reject);
          res.resume();
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          const endTime = performance.now();
          const durationMs = Math.round(endTime - timings.start);

          const contentType =
            res.headers["content-type"] ?? "";
          const isTextual =
            contentType.includes("text") ||
            contentType.includes("json") ||
            contentType.includes("xml") ||
            contentType.includes("javascript") ||
            contentType.includes("html") ||
            contentType.includes("css") ||
            contentType.includes("yaml");

          const responseHeaders: Array<{
            key: string;
            value: string;
            enabled: boolean;
          }> = [];
          for (const [key, value] of Object.entries(res.headers)) {
            const vals = Array.isArray(value) ? value : [value ?? ""];
            for (const v of vals) {
              responseHeaders.push({ key, value: v, enabled: true });
            }
          }

          resolve({
            status: res.statusCode ?? 0,
            statusText: res.statusMessage ?? "",
            headers: responseHeaders,
            bodyText: isTextual ? buffer.toString("utf-8") : undefined,
            bodyBase64: !isTextual
              ? buffer.toString("base64")
              : undefined,
            durationMs,
            dnsMs: Math.round(timings.dns - timings.start),
            connectMs: Math.round(
              timings.connect - (timings.dns || timings.start),
            ),
            tlsMs: isHttps
              ? Math.round(timings.tls - timings.connect)
              : 0,
            requestMs: Math.round(timings.request - timings.start),
            sizeBytes: buffer.length,
            contentType: contentType || undefined,
          });
        });
        res.on("error", reject);
      });

      // Capture timing events
      req.on("socket", (socket) => {
        socket.on("lookup", () => {
          timings.dns = performance.now();
        });
        socket.on("connect", () => {
          timings.connect = performance.now();
        });
        socket.on("secureConnect", () => {
          timings.tls = performance.now();
        });
      });

      req.on("timeout", () => {
        req.destroy();
        reject(
          new Error(
            `Request timed out after ${request.timeoutMs}ms`,
          ),
        );
      });

      req.on("error", (err) => {
        reject(err);
      });

      if (body) {
        req.write(body);
      }
      req.end();
    });
  }
}
