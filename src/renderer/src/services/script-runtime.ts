import type { EnvironmentVariable, ExecuteHttpResponse, SavedRequest } from "../types";

export type ScriptConsole = {
  log: (...values: unknown[]) => void;
  warn: (...values: unknown[]) => void;
  error: (...values: unknown[]) => void;
  testResult?: (passed: boolean, name: string, errMessage?: string) => void;
};

export interface KbScriptContext {
  request: SavedRequest;
  response?: ExecuteHttpResponse;
  variables: Record<string, string>;
  /** Persist a variable to the active environment (called when scripts set a variable). */
  setVariable?: (key: string, value: string) => void;
}

function buildKbRequest(request: SavedRequest) {
  return {
    get method() { return request.method; },
    set method(value: string) { (request as SavedRequest).method = value as SavedRequest["method"]; },
    get url() { return request.url; },
    set url(value: string) { request.url = value; },
    get headers() { return request.headers; },
    set headers(value: SavedRequest["headers"]) { request.headers = value; },
    get body() { return request.body; },
    set body(value: string) { request.body = value; },
    get bodyMimeType() { return request.bodyMimeType; },
    set bodyMimeType(value: string) { request.bodyMimeType = value; },
    getHeader(name: string): string | null {
      const lower = name.toLowerCase();
      const header = request.headers.find((h) => h.key.toLowerCase() === lower && h.enabled);
      return header ? header.value : null;
    },
    setHeader(name: string, value: string) {
      const lower = name.toLowerCase();
      const existing = request.headers.find((h) => h.key.toLowerCase() === lower);
      if (existing) {
        existing.value = value;
        existing.enabled = true;
      } else {
        request.headers.push({ key: name, value, enabled: true });
      }
    },
    removeHeader(name: string) {
      const lower = name.toLowerCase();
      request.headers = request.headers.filter((h) => h.key.toLowerCase() !== lower);
    },
  };
}

function buildKbResponse(response: ExecuteHttpResponse) {
  return {
    get status() { return response.status; },
    get statusText() { return response.statusText; },
    get headers() { return response.headers; },
    get body() { return response.bodyText ?? ""; },
    get durationMs() { return response.durationMs; },
    get sizeBytes() { return response.sizeBytes; },
    text(): string { return response.bodyText ?? ""; },
    json(): unknown { return JSON.parse(response.bodyText ?? "null"); },
  };
}

function buildKbVariables(
  variables: Record<string, string>,
  setVariable?: (key: string, value: string) => void,
) {
  return new Proxy(variables, {
    get(target, prop) {
      if (typeof prop === "string") return target[prop];
      return undefined;
    },
    set(target, prop, value) {
      if (typeof prop === "string") {
        target[prop] = String(value);
        setVariable?.(prop, String(value));
      }
      return true;
    },
    has(target, prop) {
      return typeof prop === "string" && prop in target;
    },
    ownKeys(target) {
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(target, prop) {
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  });
}

/**
 * Run a pre/post script in a sandboxed function. Exposes a `kb` object:
 *   kb.request.{method,url,headers,body,bodyMimeType,getHeader,setHeader,removeHeader}
 *   kb.response.{status,statusText,headers,body,durationMs,sizeBytes,text,json}
 *   kb.variables.<key>      (read or set; set persists to the active environment)
 *   kb.environment.{get,set}
 * `request`, `response`, `variables` are aliased to the `kb.*` objects for brevity.
 */
export async function runKbScript(
  content: string,
  ctx: KbScriptContext,
  console: ScriptConsole,
): Promise<void> {
  if (!content.trim()) return;

  const asyncTests: Promise<void>[] = [];

  const kb = {
    request: buildKbRequest(ctx.request),
    response: ctx.response ? buildKbResponse(ctx.response) : undefined,
    variables: buildKbVariables(ctx.variables, ctx.setVariable),
    environment: {
      get: (key: string): string | undefined => ctx.variables[key],
      set: (key: string, value: string) => {
        ctx.variables[key] = String(value);
        ctx.setVariable?.(key, String(value));
      },
    },
    test: (name: string, fn: () => void | Promise<void>) => {
      try {
        const result = fn();
        if (result instanceof Promise) {
          const promise = result.then(() => {
            if (console.testResult) console.testResult(true, name);
            else console.log(`✅ PASS: ${name}`);
          }).catch((err) => {
            if (console.testResult) console.testResult(false, name, err.message || String(err));
            else console.error(`❌ FAIL: ${name} | ${err.message || String(err)}`);
          });
          asyncTests.push(promise);
        } else {
          if (console.testResult) console.testResult(true, name);
          else console.log(`✅ PASS: ${name}`);
        }
      } catch (err: any) {
        if (console.testResult) console.testResult(false, name, err.message || String(err));
        else console.error(`❌ FAIL: ${name} | ${err.message || String(err)}`);
      }
    },
    expect: (actual: any) => ({
      toBe: (expected: any) => {
        if (actual !== expected) throw new Error(`expected ${actual} to be ${expected}`);
      },
      toEqual: (expected: any) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error(`expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
        }
      },
      toBeGreaterThan: (expected: number) => {
        if (actual <= expected) throw new Error(`expected ${actual} to be greater than ${expected}`);
      },
      toBeLessThan: (expected: number) => {
        if (actual >= expected) throw new Error(`expected ${actual} to be less than ${expected}`);
      },
      toBeTruthy: () => {
        if (!actual) throw new Error(`expected ${actual} to be truthy`);
      },
      toBeFalsy: () => {
        if (actual) throw new Error(`expected ${actual} to be falsy`);
      },
      toContain: (expected: any) => {
        if (actual && typeof actual.includes === "function") {
          if (!actual.includes(expected)) throw new Error(`expected ${JSON.stringify(actual)} to contain ${JSON.stringify(expected)}`);
        } else {
          throw new Error(`expected ${actual} to be an array or string`);
        }
      },
      toHaveProperty: (prop: string) => {
        if (!actual || typeof actual !== "object" || !(prop in actual)) {
          throw new Error(`expected ${JSON.stringify(actual)} to have property ${prop}`);
        }
      }
    })
  };

  const fn = new Function("kb", "request", "response", "variables", "console", `
    "use strict";
    return (async () => {
      ${content}
    })();
  `);

  await fn(kb, kb.request, kb.response, kb.variables, console);
  if (asyncTests.length > 0) {
    await Promise.allSettled(asyncTests);
  }
}

/** Build the script variables map from environment variables (secrets excluded). */
export function scriptVariablesFrom(variables: EnvironmentVariable[]): Record<string, string> {
  return Object.fromEntries(
    variables.map((variable) => [variable.key, variable.value]),
  );
}

// ponytail: self-check — smallest thing that fails if the kb API breaks.
if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
  void (async function demo() {
    const logs: string[] = [];
    const scriptConsole: ScriptConsole = {
      log: (...v) => logs.push(v.join(" ")),
      warn: (...v) => logs.push(v.join(" ")),
      error: (...v) => logs.push(v.join(" ")),
    };
    const request: SavedRequest = {
      id: "t", name: "t", method: "GET", url: "https://example.com", folderId: "f",
      authMode: "none", authConfig: {}, headers: [], body: "", bodyMimeType: "text/plain",
      bodyForm: [], timeoutMs: 1000, followRedirects: true,
    };
    const saved: Record<string, string> = {};
    await runKbScript(
      `kb.request.method = "POST"; kb.request.setHeader("X-Trace", "1"); kb.variables.token = "abc"; kb.environment.set("env", "prod");`,
      { request, variables: {}, setVariable: (k, v) => { saved[k] = v; } },
      scriptConsole,
    );
    const assert = (cond: boolean, msg: string) => { if (!cond) throw new Error("script-runtime self-check failed: " + msg); };
    assert(request.method === "POST", "method set");
    assert(request.headers[0]?.key === "X-Trace", "header set");
    assert(saved.token === "abc", "variable persisted via proxy");
    assert(saved.env === "prod", "variable persisted via environment.set");
  })();
}
