import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

export interface HttpRequestOptions {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface HttpResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  timeMs: number;
}

export async function executeHttpRequest(options: HttpRequestOptions): Promise<HttpResponseData> {
  const startTime = Date.now();
  const parsedUrl = new URL(options.url);
  const isHttps = parsedUrl.protocol === 'https:';
  const transport = isHttps ? https : http;

  const reqHeaders: Record<string, string> = { ...options.headers };

  return new Promise((resolve, reject) => {
    const req = transport.request(
      parsedUrl,
      {
        method: options.method || 'GET',
        headers: reqHeaders,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const duration = Date.now() - startTime;
          const resBody = Buffer.concat(chunks).toString('utf-8');
          const responseHeaders: Record<string, string> = {};
          
          for (const [key, val] of Object.entries(res.headers)) {
            if (val !== undefined) {
              responseHeaders[key] = Array.isArray(val) ? val.join(', ') : val;
            }
          }

          resolve({
            status: res.statusCode || 200,
            statusText: res.statusMessage || 'OK',
            headers: responseHeaders,
            body: resBody,
            timeMs: duration,
          });
        });
      }
    );

    req.on('error', (err) => {
      reject(err);
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}
