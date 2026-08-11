import * as vm from "node:vm";
import * as vscode from "vscode";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

/**
 * Sandboxed JavaScript execution for pre/post request scripts.
 * Provides a pm.* API surface compatible with Postman scripts.
 */
export class ScriptRunner {
  constructor(private readonly outputChannel: vscode.OutputChannel) {}

  async run(
    script: string,
    context: {
      request: { method: string; url: string; headers: Record<string, string> };
      response?: {
        status: number;
        headers: Record<string, string>;
        body: string;
        durationMs: number;
      };
      variables: Map<string, string>;
    },
  ): Promise<{ tests: TestResult[]; variables: Map<string, string>; logs: string[] }> {
    const tests: TestResult[] = [];
    const logs: string[] = [];
    const variables = new Map(context.variables);

    const pmApi = {
      test: (name: string, fn: () => void) => {
        try {
          fn();
          tests.push({ name, passed: true });
        } catch (err: unknown) {
          tests.push({
            name,
            passed: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
      expect: (actual: unknown) => ({
        to: {
          equal: (expected: unknown) => {
            if (actual !== expected) {
              throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
            }
          },
          be: {
            above: (n: number) => {
              if (typeof actual !== "number" || actual <= n) {
                throw new Error(`Expected ${actual} to be above ${n}`);
              }
            },
            below: (n: number) => {
              if (typeof actual !== "number" || actual >= n) {
                throw new Error(`Expected ${actual} to be below ${n}`);
              }
            },
            oneOf: (arr: unknown[]) => {
              if (!arr.includes(actual)) {
                throw new Error(`Expected ${JSON.stringify(actual)} to be one of ${JSON.stringify(arr)}`);
              }
            },
            a: (type: string) => {
              if (typeof actual !== type) {
                throw new Error(`Expected ${typeof actual} to be ${type}`);
              }
            },
          },
          have: {
            property: (prop: string) => {
              if (typeof actual !== "object" || actual === null || !(prop in actual)) {
                throw new Error(`Expected object to have property "${prop}"`);
              }
            },
            length: {
              above: (n: number) => {
                const len = Array.isArray(actual)
                  ? actual.length
                  : typeof actual === "string"
                    ? actual.length
                    : 0;
                if (len <= n) {
                  throw new Error(`Expected length ${len} to be above ${n}`);
                }
              },
            },
          },
          include: (item: unknown) => {
            if (typeof actual === "string" && typeof item === "string") {
              if (!actual.includes(item)) {
                throw new Error(`Expected "${actual}" to include "${item}"`);
              }
            } else if (Array.isArray(actual)) {
              if (!actual.includes(item)) {
                throw new Error(`Expected array to include ${JSON.stringify(item)}`);
              }
            }
          },
          eql: (expected: unknown) => {
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
              throw new Error(`Expected deep equal`);
            }
          },
        },
      }),
      response: context.response
        ? {
            code: context.response.status,
            status: context.response.status,
            headers: context.response.headers,
            text: () => context.response!.body,
            json: () => {
              try {
                return JSON.parse(context.response!.body);
              } catch {
                return null;
              }
            },
            responseTime: context.response.durationMs,
          }
        : undefined,
      request: {
        method: context.request.method,
        url: context.request.url,
        headers: context.request.headers,
      },
      environment: {
        get: (key: string) => variables.get(key),
        set: (key: string, value: string) => variables.set(key, value),
        has: (key: string) => variables.has(key),
      },
      variables: {
        get: (key: string) => variables.get(key),
        set: (key: string, value: string) => variables.set(key, value),
      },
    };

    const sandbox = {
      pm: pmApi,
      console: {
        log: (...args: unknown[]) => {
          const msg = args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
          logs.push(msg);
          this.outputChannel.appendLine(`[Script] ${msg}`);
        },
        warn: (...args: unknown[]) => {
          const msg = args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
          logs.push(`[WARN] ${msg}`);
          this.outputChannel.appendLine(`[Script WARN] ${msg}`);
        },
        error: (...args: unknown[]) => {
          const msg = args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
          logs.push(`[ERROR] ${msg}`);
          this.outputChannel.appendLine(`[Script ERROR] ${msg}`);
        },
      },
      JSON,
      parseInt,
      parseFloat,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Map,
      Set,
      encodeURIComponent,
      decodeURIComponent,
      btoa: (s: string) => Buffer.from(s).toString("base64"),
      atob: (s: string) => Buffer.from(s, "base64").toString("utf-8"),
    };

    try {
      const vmContext = vm.createContext(sandbox);
      vm.runInContext(script, vmContext, {
        timeout: 5000,
        filename: "script.js",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logs.push(`[Script Error] ${message}`);
      this.outputChannel.appendLine(`[Script Error] ${message}`);
    }

    return { tests, variables, logs };
  }
}
