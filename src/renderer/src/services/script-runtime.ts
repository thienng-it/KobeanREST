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
  /** Remove a variable from the active environment. */
  deleteVariable?: (key: string) => void;
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
  deleteVariable?: (key: string) => void,
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
    deleteProperty(target, prop) {
      if (typeof prop === "string") {
        delete target[prop];
        deleteVariable?.(prop);
      }
      return true;
    },
  });
}

/**
 * Build a Postman-compatible `pm` object that wraps `kb` for compatibility.
 * Postman scripts use `pm.*` API; this provides a compatibility layer.
 */
function buildPmObject(
  ctx: KbScriptContext,
  kb: ReturnType<typeof buildKbObject>,
  console: ScriptConsole
): any {
  // Create pm.request with Postman-style API
  const pmRequest = {
    // Postman uses pm.request.method for getting/setting
    get method() { return kb.request.method; },
    set method(v: string) { kb.request.method = v as any; },
    get url() { return kb.request.url; },
    set url(v: string) { kb.request.url = v; },
    get headers() {
      return {
        all: () => kb.request.headers,
        get: (name: string) => kb.request.getHeader(name),
        add: (header: { key: string; value: string }) => kb.request.setHeader(header.key, header.value),
        remove: (name: string) => kb.request.removeHeader(name),
      };
    },
    get body() { return kb.request.body; },
    set body(v: string) { kb.request.body = v; },
    // Additional Postman-style methods
    getHeaders: () => Object.fromEntries(
      kb.request.headers.filter(h => h.enabled).map(h => [h.key, h.value])
    ),
    getHeader: (name: string) => kb.request.getHeader(name),
    addHeader: (name: string, value: string) => kb.request.setHeader(name, value),
    removeHeader: (name: string) => kb.request.removeHeader(name),
  };

  // Track variables context first to avoid TDZ issues
  const ctxVariables = ctx.variables;

  // Create pm.response with Postman-style API
  const pmResponse = kb.response ? {
    get code() { return kb.response!.status; },
    get status() { return kb.response!.status; },
    get statusCode() { return kb.response!.status; },
    get responseTime() { return kb.response!.durationMs; },
    get responseSize() { return kb.response!.sizeBytes; },
    get body() { return kb.response!.body; },
    get headers() {
      return {
        all: () => kb.response!.headers,
        get: (name: string) => {
          const lower = name.toLowerCase();
          const header = kb.response!.headers.find(h => h.key.toLowerCase() === lower && h.enabled);
          return header?.value;
        },
      };
    },
    json: () => kb.response!.json(),
    text: () => kb.response!.text(),
    getHeaders: () => Object.fromEntries(
      kb.response!.headers.filter(h => h.enabled).map(h => [h.key, h.value])
    ),
    toJSON: () => ({
      code: kb.response!.status,
      status: kb.response!.status,
      body: kb.response!.body,
      responseTime: kb.response!.durationMs,
      responseSize: kb.response!.sizeBytes,
    }),
  } : undefined;

  // Postman-style environment and variables API
  const pmEnvironment = {
    get: (key: string) => kb.environment.get(key),
    set: (key: string, value: string) => kb.environment.set(key, value),
    has: (key: string) => kb.environment.get(key) !== undefined,
    unset: (key: string) => kb.environment.unset(key),
    toObject: () => ({ ...ctxVariables }),
  };

  // Postman collectionVariables API
  const pmCollectionVariables = {
    get: (key: string) => ctxVariables[key],
    set: (key: string, value: string) => {
      // Map to kb.variables for scoped variables
      (kb.variables as any)[key] = String(value);
    },
    has: (key: string) => key in ctxVariables,
    unset: (key: string) => {
      delete (kb.variables as any)[key];
    },
  };

  // Postman globals API (stub - maps to environment)
  const pmGlobals = {
    get: (key: string) => kb.environment.get(key),
    set: (key: string, value: string) => kb.environment.set(key, value),
    has: (key: string) => kb.environment.get(key) !== undefined,
    unset: (key: string) => kb.environment.unset(key),
  };

  // pm.info - metadata stub
  const pmInfo = {
    eventName: ctx.response ? "test" : "prerequest",
    requestName: ctx.request.name,
    requestId: ctx.request.id,
    iteration: 0,
    iterationCount: 1,
  };

  // pm.cookies - stub with warning
  const pmCookies = {
    get: (name: string) => {
      console.warn("⚠️ pm.cookies is not supported in KobeanREST. Cookies are not persisted.");
      return undefined;
    },
    set: (name: string, value: string) => {
      console.warn("⚠️ pm.cookies is not supported in KobeanREST. Cookie not set.");
    },
    all: () => {
      console.warn("⚠️ pm.cookies is not supported in KobeanREST. Returning empty array.");
      return [];
    },
  };

  // pm.sendRequest - delegate to kb.sendRequest (already in buildKbObject via closure)

  // Build full pm object
  const pm: any = {
    request: pmRequest,
    response: pmResponse,
    environment: pmEnvironment,
    collectionVariables: pmCollectionVariables,
    variables: pmCollectionVariables, // pm.variables is alias for collectionVariables
    globals: pmGlobals,
    info: pmInfo,
    cookies: pmCookies,

    // pm.test and pm.expect (delegate to kb)
    test: kb.test,
    expect: kb.expect,

    // pm.sendRequest (delegate to kb.sendRequest)
    sendRequest: kb.sendRequest,

    // Visualizer (stub)
    visualizer: {
      set: () => {
        console.warn("⚠️ pm.visualizer is not supported in KobeanREST.");
      },
      clear: () => {},
    },

    // IterationData (stub)
    iterationData: new Proxy({}, {
      get: () => {
        console.warn("⚠️ pm.iterationData is not supported in KobeanREST (no runner context).");
        return undefined;
      },
    }),
  };

  return pm;
}

// Helper to build the kb object (extracted for clarity)
// Used by both kb.sendRequest and pm.sendRequest
async function kbSendRequest(
  req: string | { url: string; method?: string; body?: any; headers?: any },
  callback?: (err: any, response: any) => void
): Promise<any> {
  try {
    const url = typeof req === "string" ? req : req.url;
    const method = typeof req === "string" ? "GET" : (req.method || "GET");

    const fetchOptions: RequestInit = {
      method: method.toUpperCase(),
      headers: typeof req === "string" ? {} : (req.headers || {}),
    };

    if (typeof req !== "string" && req.body) {
      if (typeof req.body === "string") {
        fetchOptions.body = req.body;
      } else {
        fetchOptions.body = JSON.stringify(req.body);
      }
    }

    console.log(`📤 kb.sendRequest: ${method} ${url}`);
    const response = await fetch(url, fetchOptions);
    const text = await response.text();

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }

    const compatibleResponse = {
      code: response.status,
      status: response.status,
      body: text,
      text: () => text,
      json: () => json,
      headers: {
        all: () => {
          const headers: Array<{ key: string; value: string }> = [];
          response.headers.forEach((value, key) => {
            headers.push({ key, value });
          });
          return headers;
        },
        get: (name: string) => response.headers.get(name),
      },
      responseTime: 0,
      toJSON: () => ({
        code: response.status,
        body: text,
      }),
    };

    if (callback) {
      callback(null, compatibleResponse);
    }

    return compatibleResponse;
  } catch (err: any) {
    console.error(`❌ kb.sendRequest failed: ${err.message}`);
    if (callback) {
      callback(err, undefined);
    }
    throw err;
  }
}

function buildKbObject(
  ctx: KbScriptContext,
  console: ScriptConsole,
  asyncTests: Promise<void>[]
) {
  return {
    request: buildKbRequest(ctx.request),
    response: ctx.response ? buildKbResponse(ctx.response) : undefined,
    variables: buildKbVariables(ctx.variables, ctx.setVariable),
    environment: {
      get: (key: string): string | undefined => ctx.variables[key],
      set: (key: string, value: string) => {
        ctx.variables[key] = String(value);
        ctx.setVariable?.(key, String(value));
      },
      unset: (key: string) => {
        delete ctx.variables[key];
        ctx.deleteVariable?.(key);
      },
    },
    sendRequest: kbSendRequest,
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
    expect: (actual: any) => {
      // Chai-style BDD assertion chain
      const chain: any = {
        _actual: actual,

        // Chainable language properties (return self)
        get to() { return chain; },
        get be() { return chain; },
        get have() { return chain; },
        get which() { return chain; },
        get and() { return chain; },
        get has() { return chain; },
        get with() { return chain; },
        get at() { return chain; },
        get of() { return chain; },
        get same() { return chain; },
        get but() { return chain; },

        // Negation
        get not() {
          chain._negate = true;
          return chain;
        },

        // Helpers
        _check: (condition: boolean, message: string) => {
          const shouldPass = chain._negate ? !condition : condition;
          if (!shouldPass) throw new Error(message);
        },

        // Jest-style assertions
        toBe: (expected: any) => {
          chain._check(actual === expected, `expected ${actual} to be ${expected}`);
        },
        toEqual: (expected: any) => {
          const match = JSON.stringify(actual) === JSON.stringify(expected);
          chain._check(match, `expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
        },
        toBeGreaterThan: (expected: number) => {
          chain._check(actual > expected, `expected ${actual} to be greater than ${expected}`);
        },
        toBeLessThan: (expected: number) => {
          chain._check(actual < expected, `expected ${actual} to be less than ${expected}`);
        },
        toBeGreaterThanOrEqual: (expected: number) => {
          chain._check(actual >= expected, `expected ${actual} to be greater than or equal to ${expected}`);
        },
        toBeLessThanOrEqual: (expected: number) => {
          chain._check(actual <= expected, `expected ${actual} to be less than or equal to ${expected}`);
        },
        toBeTruthy: () => {
          chain._check(!!actual, `expected ${actual} to be truthy`);
        },
        toBeFalsy: () => {
          chain._check(!actual, `expected ${actual} to be falsy`);
        },
        toBeNull: () => {
          chain._check(actual === null, `expected ${actual} to be null`);
        },
        toBeUndefined: () => {
          chain._check(actual === undefined, `expected ${actual} to be undefined`);
        },
        toBeDefined: () => {
          chain._check(actual !== undefined, `expected ${actual} to be defined`);
        },
        toBeNaN: () => {
          chain._check(Number.isNaN(actual), `expected ${actual} to be NaN`);
        },
        toContain: (expected: any) => {
          if (actual && typeof actual.includes === "function") {
            chain._check(actual.includes(expected), `expected ${JSON.stringify(actual)} to contain ${JSON.stringify(expected)}`);
          } else {
            throw new Error(`expected ${actual} to be an array or string`);
          }
        },
        toHaveProperty: (prop: string, value?: any) => {
          const hasProp = actual && typeof actual === "object" && (prop in actual);
          chain._check(hasProp, `expected ${JSON.stringify(actual)} to have property ${prop}`);
          if (value !== undefined) {
            chain._check(actual[prop] === value, `expected property ${prop} to be ${value}, got ${actual[prop]}`);
          }
        },
        toHaveLength: (expected: number) => {
          const len = actual?.length;
          chain._check(len === expected, `expected length ${len} to be ${expected}`);
        },
        toMatch: (regex: RegExp | string) => {
          const pattern = typeof regex === "string" ? new RegExp(regex) : regex;
          chain._check(pattern.test(String(actual)), `expected "${actual}" to match ${regex}`);
        },

        // Chai-style methods
        get a() {
          return (type: string) => {
            const typeOf = typeof actual;
            const matches = typeOf === type ||
              (type === "array" && Array.isArray(actual)) ||
              (type === "object" && actual !== null && typeOf === "object") ||
              (type === "null" && actual === null);
            chain._check(matches, `expected ${actual} to be a ${type}`);
            return chain;
          };
        },
        get an() { return chain.a; },

        property: (name: string, value?: any) => {
          const hasProp = actual && typeof actual === "object" && (name in actual);
          chain._check(hasProp, `expected ${JSON.stringify(actual)} to have property "${name}"`);
          if (value !== undefined) {
            chain._check(actual[name] === value, `expected property "${name}" to be ${value}, got ${actual[name]}`);
          }
          return chain;
        },

        get length() {
          chain._actual = actual?.length;
          return chain;
        },

        above: (n: number) => chain.toBeGreaterThan(n),
        below: (n: number) => chain.toBeLessThan(n),
        least: (n: number) => chain.toBeGreaterThanOrEqual(n),
        most: (n: number) => chain.toBeLessThanOrEqual(n),

        deep: {
          get equal() {
            return (expected: any) => chain.toEqual(expected);
          },
          get property() {
            return chain.property;
          },
          get include() {
            return chain.include;
          },
          get members() {
            return chain.members;
          }
        },

        include: (expected: any) => chain.toContain(expected),
        get includes() { return chain.include; },
        get contain() { return chain.include; },
        get contains() { return chain.include; },

        eq: (expected: any) => chain.toEqual(expected),
        eql: (expected: any) => chain.toEqual(expected),
        equal: (expected: any) => chain.toEqual(expected),
        get equals() { return chain.equal; },

        get null() { chain.toBeNull(); return chain; },
        get undefined() { chain.toBeUndefined(); return chain; },
        get NaN() { chain.toBeNaN(); return chain; },
        get exist() { chain.toBeDefined(); return chain; },
        get exists() { return chain.exist; },
        get true() { chain._check(actual === true, `expected ${actual} to be true`); return chain; },
        get false() { chain._check(actual === false, `expected ${actual} to be false`); return chain; },
        get empty() {
          const isEmpty = actual === "" ||
            (Array.isArray(actual) && actual.length === 0) ||
            (actual && typeof actual === "object" && Object.keys(actual).length === 0);
          chain._check(isEmpty, `expected ${JSON.stringify(actual)} to be empty`);
          return chain;
        },

        members: (arr: any[]) => {
          if (!Array.isArray(actual)) throw new Error(`expected ${actual} to be an array`);
          const allIn = arr.every(x => actual.includes(x));
          chain._check(allIn, `expected ${JSON.stringify(actual)} to include all members of ${JSON.stringify(arr)}`);
          return chain;
        },

        keys: (...args: any[]) => {
          const expectedKeys = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
          const actualKeys = Object.keys(actual || {});
          const hasAll = expectedKeys.every(k => actualKeys.includes(k));
          chain._check(hasAll, `expected ${JSON.stringify(actualKeys)} to include keys ${JSON.stringify(expectedKeys)}`);
          return chain;
        },
      };
      return chain;
    }
  };
}

/**
 * Run a pre/post script in a sandboxed function. Exposes:
 *
 * Primary APIs:
 *   `kb` object: KobeanREST native API
 *   `pm` object: Postman-compatible API (for imported Postman scripts)
 *
 * `request`, `response`, `variables` are aliased to the `kb.*` objects for brevity.
 *
 * Postman compatibility:
 * - pm.request, pm.response, pm.environment, pm.collectionVariables, pm.variables
 * - pm.test, pm.expect
 * - pm.sendRequest (implemented using fetch)
 * - pm.cookies (stub with warning)
 * - pm.info, pm.globals, pm.iterationData (stubs)
 */
export async function runKbScript(
  content: string,
  ctx: KbScriptContext,
  console: ScriptConsole,
): Promise<void> {
  if (!content.trim()) return;

  const asyncTests: Promise<void>[] = [];

  const kb = buildKbObject(ctx, console, asyncTests);
  const pm = buildPmObject(ctx, kb, console);

  const fn = new Function("kb", "pm", "request", "response", "variables", "console", `
    "use strict";
    return (async () => {
      ${content}
    })();
  `);

  await fn(kb, pm, kb.request, kb.response, kb.variables, console);
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
      authMode: "none", authConfig: {}, headers: [], queryParams: [], body: "", bodyMimeType: "text/plain",
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
