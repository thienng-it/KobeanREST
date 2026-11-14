import Foundation
import JavaScriptCore
import os

// MARK: - JavaScriptCore Watchdog C API

private typealias JSCShouldTerminateCallback = @convention(c) (JSContextRef?, UnsafeMutableRawPointer?) -> Bool

@_silgen_name("JSContextGroupSetExecutionTimeLimit")
private func jscContextGroupSetExecutionTimeLimit(
    _ group: JSContextGroupRef?,
    _ limit: Double,
    _ callback: JSCShouldTerminateCallback?,
    _ context: UnsafeMutableRawPointer?
)

@_silgen_name("JSContextGroupClearExecutionTimeLimit")
private func jscContextGroupClearExecutionTimeLimit(_ group: JSContextGroupRef?)

// MARK: - Public Script Contracts

public enum ScriptPhase: String, Sendable, Codable, Equatable {
    case preRequest
    case postResponse
}

public struct ScriptHeader: Sendable, Codable, Equatable {
    public var key: String
    public var value: String
    public var enabled: Bool

    public init(key: String, value: String, enabled: Bool = true) {
        self.key = key
        self.value = value
        self.enabled = enabled
    }
}

public struct ScriptRequestSnapshot: Sendable, Codable, Equatable {
    public var id: String
    public var name: String
    public var method: String
    public var url: String
    public var headers: [ScriptHeader]
    public var body: String
    public var bodyMimeType: String

    public init(
        id: String = "",
        name: String = "",
        method: String = "GET",
        url: String = "",
        headers: [ScriptHeader] = [],
        body: String = "",
        bodyMimeType: String = "text/plain"
    ) {
        self.id = id
        self.name = name
        self.method = method
        self.url = url
        self.headers = headers
        self.body = body
        self.bodyMimeType = bodyMimeType
    }
}

public struct ScriptResponseSnapshot: Sendable, Codable, Equatable {
    public var status: Int
    public var statusText: String
    public var headers: [ScriptHeader]
    public var body: String
    public var durationMs: Double
    public var sizeBytes: Int

    public init(
        status: Int,
        statusText: String = "",
        headers: [ScriptHeader] = [],
        body: String = "",
        durationMs: Double = 0,
        sizeBytes: Int = 0
    ) {
        self.status = status
        self.statusText = statusText
        self.headers = headers
        self.body = body
        self.durationMs = durationMs
        self.sizeBytes = sizeBytes
    }
}

public struct ScriptTestResult: Sendable, Codable, Equatable {
    public let name: String
    public let passed: Bool
    public let error: String?

    public init(name: String, passed: Bool, error: String? = nil) {
        self.name = name
        self.passed = passed
        self.error = error
    }
}

public enum ScriptLogLevel: String, Sendable, Codable, Equatable {
    case log
    case warn
    case error
}

public struct ScriptLogEntry: Sendable, Codable, Equatable {
    public let level: ScriptLogLevel
    public let message: String

    public init(level: ScriptLogLevel, message: String) {
        self.level = level
        self.message = message
    }
}

public struct ScriptExecutionInput: Sendable {
    public var script: String
    public var phase: ScriptPhase
    public var request: ScriptRequestSnapshot
    public var response: ScriptResponseSnapshot?
    public var variables: [String: String]
    public var environmentVariables: [String: String]
    public var timeoutMs: Int

    public init(
        script: String,
        phase: ScriptPhase = .preRequest,
        request: ScriptRequestSnapshot,
        response: ScriptResponseSnapshot? = nil,
        variables: [String: String] = [:],
        environmentVariables: [String: String] = [:],
        timeoutMs: Int = ScriptRuntime.defaultTimeoutMs
    ) {
        self.script = script
        self.phase = phase
        self.request = request
        self.response = response
        self.variables = variables
        self.environmentVariables = environmentVariables
        self.timeoutMs = timeoutMs
    }
}

public struct ScriptExecutionResult: Sendable, Equatable {
    public var mutatedRequest: ScriptRequestSnapshot
    public var updatedVariables: [String: String]
    public var unsetVariables: [String]
    public var updatedEnvVariables: [String: String]
    public var unsetEnvVariables: [String]
    public var testResults: [ScriptTestResult]
    public var consoleLogs: [ScriptLogEntry]
    public var skippedRequest: Bool
    public var error: String?

    public init(
        mutatedRequest: ScriptRequestSnapshot,
        updatedVariables: [String: String] = [:],
        unsetVariables: [String] = [],
        updatedEnvVariables: [String: String] = [:],
        unsetEnvVariables: [String] = [],
        testResults: [ScriptTestResult] = [],
        consoleLogs: [ScriptLogEntry] = [],
        skippedRequest: Bool = false,
        error: String? = nil
    ) {
        self.mutatedRequest = mutatedRequest
        self.updatedVariables = updatedVariables
        self.unsetVariables = unsetVariables
        self.updatedEnvVariables = updatedEnvVariables
        self.unsetEnvVariables = unsetEnvVariables
        self.testResults = testResults
        self.consoleLogs = consoleLogs
        self.skippedRequest = skippedRequest
        self.error = error
    }
}

// MARK: - Internal Snapshot DTOs (Plain JSON across JS boundary)

private struct ScriptBootstrapPayload: Codable {
    let phase: String
    let request: ScriptRequestSnapshot
    let response: ScriptResponseSnapshot?
    let variables: [String: String]
    let environmentVariables: [String: String]
}

// MARK: - ScriptRuntime

/// Sandboxed JavaScriptCore runner for KobeanREST (`kb.*`) and Postman-compatible (`pm.*`) scripts.
///
/// Security (T-03):
/// - Each invocation runs inside a fresh ephemeral `JSContext(virtualMachine: JSVirtualMachine())` on a background thread.
/// - Zero Objective-C / AppKit / Foundation / FileManager objects are exposed to `JSContext`.
/// - Watchdog time limit (`JSContextGroupSetExecutionTimeLimit`) terminates infinite loops cleanly.
public struct ScriptRuntime: Sendable {
    public static let defaultTimeoutMs: Int = 2000

    public init() {}

    public func execute(_ input: ScriptExecutionInput) async -> ScriptExecutionResult {
        await Self.execute(input)
    }

    public static func execute(_ input: ScriptExecutionInput) async -> ScriptExecutionResult {
        if input.script.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return ScriptExecutionResult(mutatedRequest: input.request)
        }

        return await withCheckedContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                let result = executeOnWorkerThread(input)
                continuation.resume(returning: result)
            }
        }
    }

    // MARK: - Worker Execution

    private static func executeOnWorkerThread(_ input: ScriptExecutionInput) -> ScriptExecutionResult {
        let effectiveTimeoutMs = max(1, input.timeoutMs)
        let payload = ScriptBootstrapPayload(
            phase: input.phase.rawValue,
            request: input.request,
            response: input.response,
            variables: input.variables,
            environmentVariables: input.environmentVariables
        )

        guard let payloadData = try? JSONEncoder().encode(payload),
              let payloadJSON = String(data: payloadData, encoding: .utf8)
        else {
            return ScriptExecutionResult(
                mutatedRequest: input.request,
                error: "Failed to encode script input payload"
            )
        }

        // Mutable execution state captured only by single-threaded JS host callbacks.
        final class HostState {
            var updatedVariables: [String: String] = [:]
            var unsetVariables: [String] = []
            var updatedEnvVariables: [String: String] = [:]
            var unsetEnvVariables: [String] = []
            var testResults: [ScriptTestResult] = []
            var consoleLogs: [ScriptLogEntry] = []
            var skippedRequest: Bool = false
            var uncaughtError: String?
        }

        final class TimeoutState: Sendable {
            let flag = OSAllocatedUnfairLock(initialState: false)
        }

        let state = HostState()
        let timeoutState = TimeoutState()

        guard let vm = JSVirtualMachine(),
              let context = JSContext(virtualMachine: vm)
        else {
            return ScriptExecutionResult(
                mutatedRequest: input.request,
                error: "Failed to initialize JavaScriptCore sandbox"
            )
        }

        if #available(macOS 13.3, *) {
            context.isInspectable = false
        }
        context.name = "KobeanREST.ScriptSandbox"

        context.exceptionHandler = { _, exception in
            if let message = exception?.toString(), !message.isEmpty {
                state.uncaughtError = message
            }
        }

        // Plain primitive-only callbacks: never expose Cocoa/Foundation/ObjC classes to JS.
        let logBlock: @convention(block) (String, String) -> Void = { levelRaw, message in
            let level = ScriptLogLevel(rawValue: levelRaw) ?? .log
            state.consoleLogs.append(ScriptLogEntry(level: level, message: message))
        }

        let recordTestBlock: @convention(block) (Bool, String, String) -> Void = { passed, name, errorText in
            let err: String? = (!passed && !errorText.isEmpty) ? errorText : nil
            state.testResults.append(ScriptTestResult(name: name, passed: passed, error: err))
        }

        let skipRequestBlock: @convention(block) () -> Void = {
            state.skippedRequest = true
        }

        let setVarBlock: @convention(block) (String, String) -> Void = { key, value in
            state.updatedVariables[key] = value
            state.unsetVariables.removeAll { $0 == key }
        }

        let unsetVarBlock: @convention(block) (String) -> Void = { key in
            state.updatedVariables.removeValue(forKey: key)
            if !state.unsetVariables.contains(key) {
                state.unsetVariables.append(key)
            }
        }

        let setEnvBlock: @convention(block) (String, String) -> Void = { key, value in
            state.updatedEnvVariables[key] = value
            state.unsetEnvVariables.removeAll { $0 == key }
            state.updatedVariables[key] = value
            state.unsetVariables.removeAll { $0 == key }
        }

        let unsetEnvBlock: @convention(block) (String) -> Void = { key in
            state.updatedEnvVariables.removeValue(forKey: key)
            if !state.unsetEnvVariables.contains(key) {
                state.unsetEnvVariables.append(key)
            }
            state.updatedVariables.removeValue(forKey: key)
            if !state.unsetVariables.contains(key) {
                state.unsetVariables.append(key)
            }
        }

        let bridgeDict: [String: Any] = [
            "log": unsafeBitCast(logBlock, to: AnyObject.self),
            "recordTest": unsafeBitCast(recordTestBlock, to: AnyObject.self),
            "skipRequest": unsafeBitCast(skipRequestBlock, to: AnyObject.self),
            "setVar": unsafeBitCast(setVarBlock, to: AnyObject.self),
            "unsetVar": unsafeBitCast(unsetVarBlock, to: AnyObject.self),
            "setEnv": unsafeBitCast(setEnvBlock, to: AnyObject.self),
            "unsetEnv": unsafeBitCast(unsetEnvBlock, to: AnyObject.self),
        ]

        // Install watchdog limit before evaluating bootstrap & user code.
        let group = JSContextGetGroup(context.jsGlobalContextRef)
        let limitSeconds = Double(effectiveTimeoutMs) / 1000.0
        let timeoutPtr = Unmanaged.passUnretained(timeoutState).toOpaque()
        jscContextGroupSetExecutionTimeLimit(
            group,
            limitSeconds,
            { _, rawPtr -> Bool in
                if let rawPtr {
                    let box = Unmanaged<TimeoutState>.fromOpaque(rawPtr).takeUnretainedValue()
                    box.flag.withLock { $0 = true }
                }
                return true
            },
            timeoutPtr
        )
        defer {
            jscContextGroupClearExecutionTimeLimit(group)
        }

        let setupFn = context.evaluateScript(jsBootstrapSource)
        guard state.uncaughtError == nil, let setupFn, !setupFn.isUndefined else {
            let timedOut = timeoutState.flag.withLock { $0 }
            return ScriptExecutionResult(
                mutatedRequest: input.request,
                updatedVariables: state.updatedVariables,
                unsetVariables: state.unsetVariables,
                updatedEnvVariables: state.updatedEnvVariables,
                unsetEnvVariables: state.unsetEnvVariables,
                testResults: state.testResults,
                consoleLogs: state.consoleLogs,
                skippedRequest: state.skippedRequest,
                error: timedOut
                    ? "Script execution timed out after \(effectiveTimeoutMs)ms"
                    : (state.uncaughtError ?? "Failed to initialize script runtime")
            )
        }

        let runtimeHandles = setupFn.call(withArguments: [payloadJSON, bridgeDict])
        let runUserScriptFn = runtimeHandles?.objectForKeyedSubscript("run")
        let snapshotFn = runtimeHandles?.objectForKeyedSubscript("snapshotRequest")

        if let runUserScriptFn, !runUserScriptFn.isUndefined {
            _ = runUserScriptFn.call(withArguments: [input.script])
        }

        let timedOut = timeoutState.flag.withLock { $0 }

        // Clear execution limit and exception before extracting the mutated request snapshot.
        jscContextGroupClearExecutionTimeLimit(group)
        context.exception = nil

        var mutatedRequest = input.request
        if !timedOut,
           let snapshotValue = snapshotFn?.call(withArguments: []),
           let snapshotJSON = snapshotValue.toString(),
           let snapshotData = snapshotJSON.data(using: .utf8),
           let decoded = try? JSONDecoder().decode(ScriptRequestSnapshot.self, from: snapshotData)
        {
            mutatedRequest = decoded
        }

        var finalError: String? = state.uncaughtError
        if timedOut {
            finalError = "Script execution timed out after \(effectiveTimeoutMs)ms"
        } else if state.skippedRequest,
                  let err = finalError,
                  err.contains("PM_EXECUTION_SKIP_REQUEST")
        {
            finalError = nil
        }

        return ScriptExecutionResult(
            mutatedRequest: mutatedRequest,
            updatedVariables: state.updatedVariables,
            unsetVariables: state.unsetVariables,
            updatedEnvVariables: state.updatedEnvVariables,
            unsetEnvVariables: state.unsetEnvVariables,
            testResults: state.testResults,
            consoleLogs: state.consoleLogs,
            skippedRequest: state.skippedRequest,
            error: finalError
        )
    }

    // MARK: - Sandboxed JS Bootstrap

    private static let jsBootstrapSource: String = #"""
    (function(payloadJson, bridge) {
      "use strict";

      const _parse = JSON.parse;
      const _stringify = JSON.stringify;
      const payload = _parse(payloadJson);

      const req = {
        id: String(payload.request.id || ""),
        name: String(payload.request.name || ""),
        method: String(payload.request.method || "GET"),
        url: String(payload.request.url || ""),
        headers: Array.isArray(payload.request.headers)
          ? payload.request.headers.map(function(h) {
              return { key: String(h.key || ""), value: String(h.value || ""), enabled: h.enabled !== false };
            })
          : [],
        body: String(payload.request.body || ""),
        bodyMimeType: String(payload.request.bodyMimeType || "text/plain")
      };

      const envMap = Object.create(null);
      if (payload.environmentVariables && typeof payload.environmentVariables === "object") {
        for (const k of Object.keys(payload.environmentVariables)) {
          envMap[k] = String(payload.environmentVariables[k]);
        }
      }

      const varMap = Object.assign({}, envMap);
      if (payload.variables && typeof payload.variables === "object") {
        for (const k of Object.keys(payload.variables)) {
          varMap[k] = String(payload.variables[k]);
        }
      }

      function resolveTemplate(template) {
        return String(template).replace(/\{\{([^}]+)\}\}/g, function(match, key) {
          const trimmed = String(key).trim();
          if (Object.prototype.hasOwnProperty.call(varMap, trimmed)) {
            return varMap[trimmed];
          }
          if (Object.prototype.hasOwnProperty.call(envMap, trimmed)) {
            return envMap[trimmed];
          }
          return match;
        });
      }

      function safeStringify(val) {
        if (val === undefined) return "undefined";
        if (val === null) return "null";
        if (typeof val === "string") return _stringify(val);
        try {
          return _stringify(val);
        } catch (_) {
          return String(val);
        }
      }

      function formatLogArgs(args) {
        const parts = [];
        for (let i = 0; i < args.length; i++) {
          const val = args[i];
          if (typeof val === "string") {
            parts.push(val);
          } else if (val === undefined) {
            parts.push("undefined");
          } else if (val === null) {
            parts.push("null");
          } else if (typeof val === "object") {
            try {
              parts.push(_stringify(val));
            } catch (_) {
              parts.push(String(val));
            }
          } else {
            parts.push(String(val));
          }
        }
        return parts.join(" ");
      }

      const scriptConsole = {
        log: function() { bridge.log("log", formatLogArgs(arguments)); },
        warn: function() { bridge.log("warn", formatLogArgs(arguments)); },
        error: function() { bridge.log("error", formatLogArgs(arguments)); }
      };

      function deepEqual(a, b) {
        if (Object.is(a, b)) return true;
        if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
          return false;
        }
        if (Array.isArray(a) !== Array.isArray(b)) return false;
        if (Array.isArray(a)) {
          if (a.length !== b.length) return false;
          for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i])) return false;
          }
          return true;
        }
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        for (let i = 0; i < keysA.length; i++) {
          const k = keysA[i];
          if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
          if (!deepEqual(a[k], b[k])) return false;
        }
        return true;
      }

      function parseQueryPairs(queryStr) {
        if (!queryStr) return [];
        const clean = queryStr.charAt(0) === "?" ? queryStr.slice(1) : queryStr;
        if (!clean) return [];
        return clean.split("&").filter(Boolean).map(function(part) {
          const idx = part.indexOf("=");
          if (idx === -1) {
            return { key: safeDecode(part), value: "" };
          }
          return {
            key: safeDecode(part.slice(0, idx)),
            value: safeDecode(part.slice(idx + 1))
          };
        });
      }

      function safeDecode(str) {
        try {
          return decodeURIComponent(str.replace(/\+/g, " "));
        } catch (_) {
          return str;
        }
      }

      function encodeParam(str) {
        return encodeURIComponent(String(str)).replace(/%7B/gi, "{").replace(/%7D/gi, "}");
      }

      function splitUrlParts(raw) {
        const str = String(raw || "");
        const hashIdx = str.indexOf("#");
        const hash = hashIdx >= 0 ? str.slice(hashIdx) : "";
        const beforeHash = hashIdx >= 0 ? str.slice(0, hashIdx) : str;
        const qIdx = beforeHash.indexOf("?");
        const base = qIdx >= 0 ? beforeHash.slice(0, qIdx) : beforeHash;
        const query = qIdx >= 0 ? beforeHash.slice(qIdx + 1) : "";
        return { base: base, query: query, hash: hash };
      }

      function buildUrlFromParts(base, pairs, hash) {
        if (!pairs.length) return base + hash;
        const qs = pairs.map(function(p) {
          return encodeParam(p.key) + "=" + encodeParam(p.value);
        }).join("&");
        return base + "?" + qs + hash;
      }

      function extractAuthorityAndPath(raw) {
        let s = splitUrlParts(raw).base;
        const schemeIdx = s.indexOf("://");
        if (schemeIdx >= 0) {
          s = s.slice(schemeIdx + 3);
        }
        const slashIdx = s.indexOf("/");
        const hostPart = slashIdx >= 0 ? s.slice(0, slashIdx) : s;
        const pathPart = slashIdx >= 0 ? s.slice(slashIdx + 1) : "";
        return {
          host: hostPart ? hostPart.split(".") : [],
          path: pathPart ? pathPart.split("/").filter(Boolean) : []
        };
      }

      const kbRequest = {
        get method() { return req.method; },
        set method(v) { req.method = String(v); },
        get url() { return req.url; },
        set url(v) { req.url = String(v); },
        get headers() { return req.headers; },
        set headers(v) {
          req.headers = Array.isArray(v)
            ? v.map(function(h) {
                return { key: String(h.key || ""), value: String(h.value || ""), enabled: h.enabled !== false };
              })
            : [];
        },
        get body() { return req.body; },
        set body(v) { req.body = v === undefined || v === null ? "" : String(v); },
        get bodyMimeType() { return req.bodyMimeType; },
        set bodyMimeType(v) { req.bodyMimeType = String(v); },
        getHeader: function(name) {
          const lower = String(name).toLowerCase();
          for (let i = 0; i < req.headers.length; i++) {
            const h = req.headers[i];
            if (h.enabled && h.key.toLowerCase() === lower) {
              return h.value;
            }
          }
          return null;
        },
        setHeader: function(name, value) {
          const keyStr = String(name);
          const lower = keyStr.toLowerCase();
          const valStr = String(value);
          for (let i = 0; i < req.headers.length; i++) {
            if (req.headers[i].key.toLowerCase() === lower) {
              req.headers[i].value = valStr;
              req.headers[i].enabled = true;
              return;
            }
          }
          req.headers.push({ key: keyStr, value: valStr, enabled: true });
        },
        removeHeader: function(name) {
          const lower = String(name).toLowerCase();
          req.headers = req.headers.filter(function(h) {
            return h.key.toLowerCase() !== lower;
          });
        }
      };

      let kbResponse;
      if (payload.response) {
        const resp = payload.response;
        const respHeaders = Array.isArray(resp.headers)
          ? resp.headers.map(function(h) {
              return { key: String(h.key || ""), value: String(h.value || ""), enabled: h.enabled !== false };
            })
          : [];
        kbResponse = {
          get status() { return resp.status; },
          get statusText() { return resp.statusText; },
          get headers() { return respHeaders; },
          get body() { return resp.body; },
          get durationMs() { return resp.durationMs; },
          get sizeBytes() { return resp.sizeBytes; },
          text: function() { return resp.body; },
          json: function() { return _parse(resp.body || "null"); }
        };
      }

      const varMethods = {
        get: function(key) {
          const k = String(key);
          return Object.prototype.hasOwnProperty.call(varMap, k) ? varMap[k] : undefined;
        },
        set: function(key, value) {
          const k = String(key);
          const v = String(value);
          varMap[k] = v;
          bridge.setVar(k, v);
        },
        has: function(key) {
          return Object.prototype.hasOwnProperty.call(varMap, String(key));
        },
        unset: function(key) {
          const k = String(key);
          delete varMap[k];
          bridge.unsetVar(k);
        }
      };

      const kbVariables = new Proxy(varMap, {
        get: function(target, prop) {
          if (typeof prop !== "string") return undefined;
          if (Object.prototype.hasOwnProperty.call(target, prop)) {
            return target[prop];
          }
          if (Object.prototype.hasOwnProperty.call(varMethods, prop)) {
            return varMethods[prop];
          }
          return undefined;
        },
        set: function(target, prop, value) {
          if (typeof prop === "string") {
            const v = String(value);
            target[prop] = v;
            bridge.setVar(prop, v);
          }
          return true;
        },
        has: function(target, prop) {
          return typeof prop === "string" && Object.prototype.hasOwnProperty.call(target, prop);
        },
        ownKeys: function(target) {
          return Reflect.ownKeys(target);
        },
        getOwnPropertyDescriptor: function(target, prop) {
          return Reflect.getOwnPropertyDescriptor(target, prop);
        },
        deleteProperty: function(target, prop) {
          if (typeof prop === "string") {
            delete target[prop];
            bridge.unsetVar(prop);
          }
          return true;
        }
      });

      const kbEnvironment = {
        get: function(key) {
          const k = String(key);
          return Object.prototype.hasOwnProperty.call(envMap, k) ? envMap[k] : undefined;
        },
        set: function(key, value) {
          const k = String(key);
          const v = String(value);
          envMap[k] = v;
          varMap[k] = v;
          bridge.setEnv(k, v);
        },
        unset: function(key) {
          const k = String(key);
          delete envMap[k];
          delete varMap[k];
          bridge.unsetEnv(k);
        }
      };

      let activeTestCount = 0;

      function kbTest(name, fn) {
        const testName = String(name);
        activeTestCount++;
        try {
          const res = fn();
          if (res && typeof res.then === "function") {
            res.then(function() {
              activeTestCount--;
              bridge.recordTest(true, testName, "");
            }, function(err) {
              activeTestCount--;
              bridge.recordTest(false, testName, err && err.message ? String(err.message) : String(err));
            });
          } else {
            activeTestCount--;
            bridge.recordTest(true, testName, "");
          }
        } catch (err) {
          activeTestCount--;
          bridge.recordTest(false, testName, err && err.message ? String(err.message) : String(err));
        }
      }

      function kbExpect(actual) {
        const chain = {
          _actual: actual,
          _negate: false,

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

          get not() {
            chain._negate = !chain._negate;
            return chain;
          },

          _check: function(condition, message) {
            const shouldPass = chain._negate ? !condition : !!condition;
            if (activeTestCount === 0) {
              bridge.recordTest(shouldPass, "Assertion: " + message, shouldPass ? "" : message);
            }
            if (!shouldPass) {
              throw new Error(message);
            }
          },

          toBe: function(expected) {
            chain._check(chain._actual === expected, "expected " + chain._actual + " to be " + expected);
            return chain;
          },
          toEqual: function(expected) {
            const match = deepEqual(chain._actual, expected);
            chain._check(match, "expected " + safeStringify(chain._actual) + " to equal " + safeStringify(expected));
            return chain;
          },
          toBeGreaterThan: function(expected) {
            chain._check(chain._actual > expected, "expected " + chain._actual + " to be greater than " + expected);
            return chain;
          },
          toBeLessThan: function(expected) {
            chain._check(chain._actual < expected, "expected " + chain._actual + " to be less than " + expected);
            return chain;
          },
          toBeGreaterThanOrEqual: function(expected) {
            chain._check(chain._actual >= expected, "expected " + chain._actual + " to be greater than or equal to " + expected);
            return chain;
          },
          toBeLessThanOrEqual: function(expected) {
            chain._check(chain._actual <= expected, "expected " + chain._actual + " to be less than or equal to " + expected);
            return chain;
          },
          toBeTruthy: function() {
            chain._check(!!chain._actual, "expected " + chain._actual + " to be truthy");
            return chain;
          },
          toBeFalsy: function() {
            chain._check(!chain._actual, "expected " + chain._actual + " to be falsy");
            return chain;
          },
          toBeNull: function() {
            chain._check(chain._actual === null, "expected " + chain._actual + " to be null");
            return chain;
          },
          toBeUndefined: function() {
            chain._check(chain._actual === undefined, "expected " + chain._actual + " to be undefined");
            return chain;
          },
          toBeDefined: function() {
            chain._check(chain._actual !== undefined, "expected " + chain._actual + " to be defined");
            return chain;
          },
          toBeNaN: function() {
            chain._check(Number.isNaN(chain._actual), "expected " + chain._actual + " to be NaN");
            return chain;
          },
          toContain: function(expected) {
            const cur = chain._actual;
            if (cur !== null && cur !== undefined && typeof cur.includes === "function") {
              chain._check(cur.includes(expected), "expected " + safeStringify(cur) + " to contain " + safeStringify(expected));
            } else {
              throw new Error("expected " + cur + " to be an array or string");
            }
            return chain;
          },
          toHaveProperty: function(prop, value) {
            const cur = chain._actual;
            const hasProp = cur !== null && cur !== undefined && typeof cur === "object" && (prop in cur);
            if (arguments.length >= 2 && value !== undefined) {
              if (chain._negate) {
                chain._check(hasProp && deepEqual(cur[prop], value), "expected property " + prop + " not to equal " + safeStringify(value));
              } else {
                chain._check(hasProp, "expected " + safeStringify(cur) + " to have property " + prop);
                chain._check(deepEqual(cur[prop], value), "expected property " + prop + " to be " + safeStringify(value) + ", got " + safeStringify(cur[prop]));
              }
            } else {
              chain._check(hasProp, "expected " + safeStringify(cur) + " to have property " + prop);
            }
            return chain;
          },
          toHaveLength: function(expected) {
            const cur = chain._actual;
            const len = cur !== null && cur !== undefined ? cur.length : undefined;
            chain._check(len === expected, "expected length " + len + " to be " + expected);
            return chain;
          },
          toMatch: function(regex) {
            const pattern = typeof regex === "string" ? new RegExp(regex) : regex;
            chain._check(pattern.test(String(chain._actual)), "expected \"" + chain._actual + "\" to match " + regex);
            return chain;
          },

          get a() {
            return function(type) {
              const cur = chain._actual;
              const t = typeof cur;
              const normalized = String(type).toLowerCase();
              const matches =
                (normalized === "array" && Array.isArray(cur)) ||
                (normalized === "null" && cur === null) ||
                (normalized === "object" && cur !== null && !Array.isArray(cur) && t === "object") ||
                (normalized !== "array" && normalized !== "null" && normalized !== "object" && t === normalized);
              chain._check(matches, "expected " + cur + " to be a " + type);
              return chain;
            };
          },
          get an() { return chain.a; },

          property: function(name, value) {
            if (arguments.length >= 2) {
              return chain.toHaveProperty(name, value);
            }
            return chain.toHaveProperty(name);
          },

          get length() {
            const cur = chain._actual;
            chain._actual = cur !== null && cur !== undefined ? cur.length : undefined;
            return chain;
          },
          lengthOf: function(n) { return chain.toHaveLength(n); },

          above: function(n) { return chain.toBeGreaterThan(n); },
          below: function(n) { return chain.toBeLessThan(n); },
          least: function(n) { return chain.toBeGreaterThanOrEqual(n); },
          most: function(n) { return chain.toBeLessThanOrEqual(n); },

          deep: {
            get equal() { return function(expected) { return chain.toEqual(expected); }; },
            get equals() { return function(expected) { return chain.toEqual(expected); }; },
            get eql() { return function(expected) { return chain.toEqual(expected); }; },
            get property() { return chain.property; },
            get include() { return chain.include; },
            get members() { return chain.members; }
          },

          include: function(expected) {
            const cur = chain._actual;
            if (cur !== null && cur !== undefined && typeof cur === "object" && !Array.isArray(cur) && expected && typeof expected === "object") {
              const allMatch = Object.keys(expected).every(function(k) {
                return (k in cur) && deepEqual(cur[k], expected[k]);
              });
              chain._check(allMatch, "expected " + safeStringify(cur) + " to include " + safeStringify(expected));
              return chain;
            }
            return chain.toContain(expected);
          },
          get includes() { return chain.include; },
          get contain() { return chain.include; },
          get contains() { return chain.include; },

          eq: function(expected) { return chain.toEqual(expected); },
          eql: function(expected) { return chain.toEqual(expected); },
          equal: function(expected) {
            if (chain._actual === expected || (typeof chain._actual === "object" && chain._actual !== null)) {
              return chain.toEqual(expected);
            }
            return chain.toBe(expected);
          },
          get equals() { return chain.equal; },

          get null() { chain.toBeNull(); return chain; },
          get undefined() { chain.toBeUndefined(); return chain; },
          get NaN() { chain.toBeNaN(); return chain; },
          get exist() { chain.toBeDefined(); return chain; },
          get exists() { return chain.exist; },
          get ok() { chain.toBeTruthy(); return chain; },
          get true() { chain._check(chain._actual === true, "expected " + chain._actual + " to be true"); return chain; },
          get false() { chain._check(chain._actual === false, "expected " + chain._actual + " to be false"); return chain; },
          get empty() {
            const cur = chain._actual;
            const isEmpty = cur === "" ||
              (Array.isArray(cur) && cur.length === 0) ||
              (cur !== null && cur !== undefined && typeof cur === "object" && Object.keys(cur).length === 0);
            chain._check(isEmpty, "expected " + safeStringify(cur) + " to be empty");
            return chain;
          },

          match: function(regex) { return chain.toMatch(regex); },

          members: function(arr) {
            const cur = chain._actual;
            if (!Array.isArray(cur)) throw new Error("expected " + cur + " to be an array");
            const allIn = arr.every(function(x) {
              return cur.some(function(item) { return deepEqual(item, x); });
            });
            chain._check(allIn, "expected " + safeStringify(cur) + " to include all members of " + safeStringify(arr));
            return chain;
          },

          keys: function() {
            const expectedKeys = arguments.length === 1 && Array.isArray(arguments[0])
              ? arguments[0]
              : Array.prototype.slice.call(arguments);
            const cur = chain._actual;
            const actualKeys = Object.keys(cur || {});
            const hasAll = expectedKeys.every(function(k) { return actualKeys.indexOf(k) !== -1; });
            chain._check(hasAll, "expected " + safeStringify(actualKeys) + " to include keys " + safeStringify(expectedKeys));
            return chain;
          }
        };
        return chain;
      }

      const kbSendRequest = function(reqArg, cb) {
        const err = new Error("sendRequest is not supported inside the sandboxed macOS script runtime");
        scriptConsole.warn(err.message);
        if (typeof cb === "function") {
          cb(err, undefined);
        }
        return Promise.reject(err);
      };

      const kb = {
        request: kbRequest,
        response: kbResponse,
        variables: kbVariables,
        environment: kbEnvironment,
        sendRequest: kbSendRequest,
        test: kbTest,
        expect: kbExpect
      };

      const pmRequest = {
        get method() { return kbRequest.method; },
        set method(v) { kbRequest.method = v; },
        get url() {
          const urlStr = kbRequest.url || "";
          const parts = splitUrlParts(urlStr);
          const pairs = parseQueryPairs(parts.query);
          const authPath = extractAuthorityAndPath(resolveTemplate(urlStr));

          const urlObj = {
            toString: function() { return urlStr; },
            toJSON: function() { return urlStr; },
            update: function(val) { kbRequest.url = String(val); },
            addQueryParams: function(params) {
              const curParts = splitUrlParts(kbRequest.url);
              const curPairs = parseQueryPairs(curParts.query);
              if (typeof params === "string") {
                const parsed = parseQueryPairs(params);
                for (let i = 0; i < parsed.length; i++) curPairs.push(parsed[i]);
              } else if (params && typeof params === "object") {
                const keys = Object.keys(params);
                for (let i = 0; i < keys.length; i++) {
                  curPairs.push({ key: keys[i], value: String(params[keys[i]]) });
                }
              }
              kbRequest.url = buildUrlFromParts(curParts.base, curPairs, curParts.hash);
            },
            removeQueryParams: function(params) {
              const keys = Array.isArray(params) ? params : [params];
              const curParts = splitUrlParts(kbRequest.url);
              const curPairs = parseQueryPairs(curParts.query).filter(function(p) {
                return keys.indexOf(p.key) === -1;
              });
              kbRequest.url = buildUrlFromParts(curParts.base, curPairs, curParts.hash);
            }
          };

          const queryList = pairs.map(function(p) { return { key: p.key, value: p.value }; });
          queryList.get = function(key) {
            for (let i = 0; i < queryList.length; i++) {
              if (queryList[i].key === key) return queryList[i].value;
            }
            return undefined;
          };
          queryList.has = function(key) {
            return queryList.some(function(q) { return q.key === key; });
          };
          queryList.all = function() { return queryList.slice(); };
          queryList.count = function() { return queryList.length; };
          queryList.clear = function() {
            const curParts = splitUrlParts(kbRequest.url);
            kbRequest.url = buildUrlFromParts(curParts.base, [], curParts.hash);
          };
          queryList.remove = function(params) {
            if (typeof params === "function") {
              const toRemove = queryList.filter(params).map(function(q) { return q.key; });
              urlObj.removeQueryParams(toRemove);
            } else {
              urlObj.removeQueryParams(params);
            }
          };
          queryList.add = function(params) {
            const items = Array.isArray(params) ? params : [params];
            const curParts = splitUrlParts(kbRequest.url);
            const curPairs = parseQueryPairs(curParts.query);
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              if (typeof item === "string") {
                const parsed = parseQueryPairs(item);
                for (let j = 0; j < parsed.length; j++) curPairs.push(parsed[j]);
              } else if (item && item.key !== undefined) {
                curPairs.push({ key: String(item.key), value: item.value !== undefined ? String(item.value) : "" });
              }
            }
            kbRequest.url = buildUrlFromParts(curParts.base, curPairs, curParts.hash);
          };
          queryList.insert = function(params) { queryList.add(params); };
          queryList.upsert = function(params) {
            const items = Array.isArray(params) ? params : [params];
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              if (item && item.key) {
                urlObj.removeQueryParams(item.key);
                queryList.add(item);
              }
            }
          };
          queryList.each = queryList.forEach;

          urlObj.query = queryList;
          urlObj[Symbol.toPrimitive] = function() { return urlStr; };
          Object.defineProperty(urlObj, "host", { get: function() { return authPath.host; } });
          Object.defineProperty(urlObj, "path", { get: function() { return authPath.path; } });
          return urlObj;
        },
        set url(v) {
          kbRequest.url = (v && typeof v === "object" && typeof v.toString === "function") ? v.toString() : String(v);
        },
        get headers() {
          const headersList = kbRequest.headers.slice();
          headersList.all = function() { return kbRequest.headers; };
          headersList.get = function(name) { return kbRequest.getHeader(name); };
          headersList.add = function(header) {
            if (typeof header === "string") {
              const idx = header.indexOf(":");
              if (idx > 0) {
                kbRequest.setHeader(header.slice(0, idx).trim(), header.slice(idx + 1).trim());
              }
            } else if (header && header.key) {
              kbRequest.setHeader(header.key, String(header.value));
            }
          };
          headersList.insert = function(header) { headersList.add(header); };
          headersList.upsert = function(header) {
            if (header && header.key) kbRequest.setHeader(header.key, String(header.value));
          };
          headersList.remove = function(match) {
            if (typeof match === "function") {
              const keys = kbRequest.headers.filter(match).map(function(h) { return h.key; });
              for (let i = 0; i < keys.length; i++) kbRequest.removeHeader(keys[i]);
            } else {
              kbRequest.removeHeader(match);
            }
          };
          headersList.has = function(name) { return kbRequest.getHeader(name) !== null; };
          headersList.clear = function() { kbRequest.headers = []; };
          headersList.count = function() { return kbRequest.headers.length; };
          headersList.each = headersList.forEach;
          return headersList;
        },
        get body() { return kbRequest.body; },
        set body(v) { kbRequest.body = v; },
        getHeaders: function() {
          const out = {};
          for (let i = 0; i < kbRequest.headers.length; i++) {
            const h = kbRequest.headers[i];
            if (h.enabled) out[h.key] = h.value;
          }
          return out;
        },
        getHeader: function(name) { return kbRequest.getHeader(name); },
        addHeader: function(name, value) { kbRequest.setHeader(name, value); },
        removeHeader: function(name) { kbRequest.removeHeader(name); }
      };

      let pmResponse;
      if (kbResponse) {
        pmResponse = {
          get code() { return kbResponse.status; },
          get status() { return kbResponse.status; },
          get statusCode() { return kbResponse.status; },
          get responseTime() { return kbResponse.durationMs; },
          get responseSize() { return kbResponse.sizeBytes; },
          get body() { return kbResponse.body; },
          get headers() {
            return {
              all: function() { return kbResponse.headers; },
              get: function(name) {
                const lower = String(name).toLowerCase();
                for (let i = 0; i < kbResponse.headers.length; i++) {
                  const h = kbResponse.headers[i];
                  if (h.enabled && h.key.toLowerCase() === lower) return h.value;
                }
                return undefined;
              }
            };
          },
          json: function() { return kbResponse.json(); },
          text: function() { return kbResponse.text(); },
          getHeaders: function() {
            const out = {};
            for (let i = 0; i < kbResponse.headers.length; i++) {
              const h = kbResponse.headers[i];
              if (h.enabled) out[h.key] = h.value;
            }
            return out;
          },
          toJSON: function() {
            return {
              code: kbResponse.status,
              status: kbResponse.status,
              body: kbResponse.body,
              responseTime: kbResponse.durationMs,
              responseSize: kbResponse.sizeBytes
            };
          },
          to: {
            have: {
              status: function(expected) {
                kbExpect(kbResponse.status).to.equal(expected);
              },
              header: function(name, value) {
                const lower = String(name).toLowerCase();
                let found;
                for (let i = 0; i < kbResponse.headers.length; i++) {
                  if (kbResponse.headers[i].enabled && kbResponse.headers[i].key.toLowerCase() === lower) {
                    found = kbResponse.headers[i].value;
                    break;
                  }
                }
                kbExpect(found).to.exist;
                if (arguments.length >= 2) {
                  kbExpect(found).to.equal(value);
                }
              }
            },
            be: {
              get ok() { kbExpect(kbResponse.status).to.be.at.least(200); kbExpect(kbResponse.status).to.be.below(300); return true; },
              get json() { kbResponse.json(); return true; }
            }
          }
        };
      }

      const pmEnvironment = {
        get: function(key) { return kbEnvironment.get(key); },
        set: function(key, value) { kbEnvironment.set(key, value); },
        has: function(key) { return kbEnvironment.get(key) !== undefined; },
        unset: function(key) { kbEnvironment.unset(key); },
        toObject: function() { return Object.assign({}, envMap); },
        replaceIn: function(template) { return resolveTemplate(template); }
      };

      const pmCollectionVariables = {
        get: function(key) { return varMethods.get(key); },
        set: function(key, value) { varMethods.set(key, value); },
        has: function(key) { return varMethods.has(key); },
        unset: function(key) { varMethods.unset(key); },
        toObject: function() { return Object.assign({}, varMap); },
        replaceIn: function(template) { return resolveTemplate(template); }
      };

      const pmGlobals = {
        get: function(key) { return kbEnvironment.get(key); },
        set: function(key, value) { kbEnvironment.set(key, value); },
        has: function(key) { return kbEnvironment.get(key) !== undefined; },
        unset: function(key) { kbEnvironment.unset(key); },
        replaceIn: function(template) { return resolveTemplate(template); }
      };

      const pmInfo = {
        eventName: (payload.phase === "postResponse" || kbResponse) ? "test" : "prerequest",
        requestName: req.name,
        requestId: req.id,
        iteration: 0,
        iterationCount: 1
      };

      const pmExecution = {
        skipRequest: function() {
          bridge.skipRequest();
          throw new Error("PM_EXECUTION_SKIP_REQUEST");
        }
      };

      const pmCookies = {
        get: function() { scriptConsole.warn("pm.cookies is not supported in KobeanREST."); return undefined; },
        set: function() { scriptConsole.warn("pm.cookies is not supported in KobeanREST."); },
        all: function() { scriptConsole.warn("pm.cookies is not supported in KobeanREST."); return []; },
        has: function() { scriptConsole.warn("pm.cookies is not supported in KobeanREST."); return false; },
        delete: function() { scriptConsole.warn("pm.cookies is not supported in KobeanREST."); },
        clear: function() { scriptConsole.warn("pm.cookies is not supported in KobeanREST."); }
      };

      const pm = {
        request: pmRequest,
        response: pmResponse,
        environment: pmEnvironment,
        collectionVariables: pmCollectionVariables,
        variables: pmCollectionVariables,
        globals: pmGlobals,
        info: pmInfo,
        execution: pmExecution,
        cookies: pmCookies,
        test: kbTest,
        expect: kbExpect,
        sendRequest: kbSendRequest,
        visualizer: {
          set: function() { scriptConsole.warn("pm.visualizer is not supported in KobeanREST."); },
          clear: function() {}
        },
        iterationData: {
          get: function() { scriptConsole.warn("pm.iterationData is not supported in KobeanREST."); return undefined; },
          has: function() { scriptConsole.warn("pm.iterationData is not supported in KobeanREST."); return false; },
          toObject: function() { scriptConsole.warn("pm.iterationData is not supported in KobeanREST."); return {}; },
          toJSON: function() { scriptConsole.warn("pm.iterationData is not supported in KobeanREST."); return {}; }
        }
      };

      globalThis.kb = kb;
      globalThis.pm = pm;
      globalThis.request = kbRequest;
      globalThis.response = kbResponse;
      globalThis.variables = kbVariables;
      globalThis.console = scriptConsole;

      return {
        run: function(userScript) {
          const fn = new Function(
            "kb", "pm", "request", "response", "variables", "console",
            "\"use strict\";\n" + String(userScript)
          );
          return fn(kb, pm, kbRequest, kbResponse, kbVariables, scriptConsole);
        },
        snapshotRequest: function() {
          return _stringify({
            id: req.id,
            name: req.name,
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: req.body,
            bodyMimeType: req.bodyMimeType
          });
        }
      };
    })
    """#
}
