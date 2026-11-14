import XCTest
#if canImport(KobeanREST)
@testable import KobeanREST
#endif

final class ScriptRuntimeTests: XCTestCase {
    func testEmptyScriptIsNoOp() async {
        let request = ScriptRequestSnapshot(
            method: "GET",
            url: "https://api.example.com/users",
            headers: [ScriptHeader(key: "Accept", value: "application/json")]
        )
        let result = await ScriptRuntime.execute(
            ScriptExecutionInput(script: "   \n\t ", phase: .preRequest, request: request)
        )

        XCTAssertEqual(result.mutatedRequest, request)
        XCTAssertTrue(result.updatedVariables.isEmpty)
        XCTAssertTrue(result.updatedEnvVariables.isEmpty)
        XCTAssertTrue(result.testResults.isEmpty)
        XCTAssertTrue(result.consoleLogs.isEmpty)
        XCTAssertFalse(result.skippedRequest)
        XCTAssertNil(result.error)
    }

    func testPreRequestMutatesHeadersMethodUrlAndEnvironmentVariables() async {
        let request = ScriptRequestSnapshot(
            id: "req-1",
            name: "Create User",
            method: "GET",
            url: "https://api.example.com/users?page=1",
            headers: [ScriptHeader(key: "X-Remove", value: "old")],
            body: "",
            bodyMimeType: "text/plain"
        )

        let script = """
        kb.request.method = "POST";
        kb.request.setHeader("X-Trace-Id", "trace-123");
        kb.request.removeHeader("x-remove");
        pm.request.headers.add({ key: "Authorization", value: "Bearer secret" });
        pm.request.url.addQueryParams({ active: "true" });
        kb.request.body = JSON.stringify({ hello: "world" });
        kb.request.bodyMimeType = "application/json";

        variables.localToken = "loc-1";
        pm.variables.set("collectionVar", "col-2");
        pm.environment.set("API_TOKEN", "env-999");
        pm.environment.unset("STALE_KEY");
        delete variables.DROP_ME;

        console.log("prepared", pm.info.eventName, pm.info.requestName);
        """

        let result = await ScriptRuntime.execute(
            ScriptExecutionInput(
                script: script,
                phase: .preRequest,
                request: request,
                variables: ["DROP_ME": "gone"],
                environmentVariables: ["STALE_KEY": "old", "BASE": "https://api.example.com"]
            )
        )

        XCTAssertNil(result.error)
        XCTAssertFalse(result.skippedRequest)
        XCTAssertEqual(result.mutatedRequest.method, "POST")
        XCTAssertEqual(result.mutatedRequest.url, "https://api.example.com/users?page=1&active=true")
        XCTAssertEqual(result.mutatedRequest.body, #"{"hello":"world"}"#)
        XCTAssertEqual(result.mutatedRequest.bodyMimeType, "application/json")
        XCTAssertEqual(
            result.mutatedRequest.headers,
            [
                ScriptHeader(key: "X-Trace-Id", value: "trace-123", enabled: true),
                ScriptHeader(key: "Authorization", value: "Bearer secret", enabled: true),
            ]
        )

        XCTAssertEqual(result.updatedVariables["localToken"], "loc-1")
        XCTAssertEqual(result.updatedVariables["collectionVar"], "col-2")
        XCTAssertEqual(result.updatedVariables["API_TOKEN"], "env-999")
        XCTAssertTrue(result.unsetVariables.contains("DROP_ME"))
        XCTAssertTrue(result.unsetVariables.contains("STALE_KEY"))
        XCTAssertEqual(result.updatedEnvVariables, ["API_TOKEN": "env-999"])
        XCTAssertEqual(result.unsetEnvVariables, ["STALE_KEY"])
        XCTAssertEqual(result.consoleLogs, [ScriptLogEntry(level: .log, message: "prepared prerequest Create User")])
    }

    func testPostResponsePmTestAndExpectJestAndChaiStyles() async {
        let request = ScriptRequestSnapshot(id: "req-2", name: "Get Profile", method: "GET", url: "https://api.example.com/me")
        let response = ScriptResponseSnapshot(
            status: 200,
            statusText: "OK",
            headers: [ScriptHeader(key: "Content-Type", value: "application/json")],
            body: #"{"id":42,"name":"Ada","roles":["admin","dev"],"emptyArr":[],"flag":true,"nothing":null}"#,
            durationMs: 37.5,
            sizeBytes: 84
        )

        let script = """
        pm.test("Chai assertions pass", function() {
            const data = pm.response.json();
            pm.expect(pm.response.code).to.be.equal(200);
            pm.expect(data).to.eql({ id: 42, name: "Ada", roles: ["admin", "dev"], emptyArr: [], flag: true, nothing: null });
            pm.expect(data.roles).to.include("admin");
            pm.expect(data).to.have.property("name", "Ada");
            pm.expect(data).not.to.have.property("password");
            pm.expect(data.flag).to.be.true;
            pm.expect(false).to.be.false;
            pm.expect(data.nothing).to.be.null;
            pm.expect(data.missing).to.be.undefined;
            pm.expect(data.emptyArr).to.be.empty;
            pm.expect(data.roles).to.be.an("array");
            pm.expect(data.roles).to.have.length.above(1);
            pm.response.to.have.status(200);
        });

        kb.test("Jest assertions pass", function() {
            const data = kb.response.json();
            kb.expect(kb.response.status).toBe(200);
            kb.expect(data.roles).toEqual(["admin", "dev"]);
            kb.expect(data.id).toBeGreaterThan(40);
            kb.expect(data.id).toBeLessThan(50);
            kb.expect(data.roles).toContain("dev");
            kb.expect(data).toHaveProperty("id", 42);
            kb.expect(data.flag).toBeTruthy();
            kb.expect(0).toBeFalsy();
            kb.expect(data.nothing).toBeNull();
            kb.expect(data.missing).toBeUndefined();
            kb.expect(data.name).toBeDefined();
            kb.expect(data.name).toMatch(/^Ad/);
        });

        pm.test("Failing assertion is isolated", function() {
            pm.expect(pm.response.code).to.equal(500);
        });
        """

        let result = await ScriptRuntime.execute(
            ScriptExecutionInput(script: script, phase: .postResponse, request: request, response: response)
        )

        XCTAssertNil(result.error)
        XCTAssertEqual(result.testResults.count, 3)
        XCTAssertEqual(result.testResults[0], ScriptTestResult(name: "Chai assertions pass", passed: true, error: nil))
        XCTAssertEqual(result.testResults[1], ScriptTestResult(name: "Jest assertions pass", passed: true, error: nil))
        XCTAssertEqual(result.testResults[2].name, "Failing assertion is isolated")
        XCTAssertFalse(result.testResults[2].passed)
        XCTAssertNotNil(result.testResults[2].error)
    }

    func testPmExecutionSkipRequestAbortsCleanlyWithoutError() async {
        let request = ScriptRequestSnapshot(method: "GET", url: "https://api.example.com/protected")
        let script = """
        pm.request.addHeader("X-Before-Skip", "1");
        console.warn("skipping request");
        pm.execution.skipRequest();
        pm.request.addHeader("X-After-Skip", "2");
        """

        let result = await ScriptRuntime.execute(
            ScriptExecutionInput(script: script, phase: .preRequest, request: request)
        )

        XCTAssertTrue(result.skippedRequest)
        XCTAssertNil(result.error)
        XCTAssertEqual(result.mutatedRequest.headers, [ScriptHeader(key: "X-Before-Skip", value: "1", enabled: true)])
        XCTAssertEqual(result.consoleLogs, [ScriptLogEntry(level: .warn, message: "skipping request")])
    }

    func testInfiniteLoopAbortsWithinTimeoutAndDoesNotBlockMainThread() async {
        let request = ScriptRequestSnapshot(method: "GET", url: "https://api.example.com")
        let script = """
        try {
            while (true) {}
        } catch (e) {
            console.error("caught", e);
        }
        """

        let start = Date()
        let result = await ScriptRuntime.execute(
            ScriptExecutionInput(script: script, phase: .preRequest, request: request, timeoutMs: 150)
        )
        let elapsedMs = Date().timeIntervalSince(start) * 1000.0

        XCTAssertNotNil(result.error)
        XCTAssertTrue(result.error?.localizedCaseInsensitiveContains("timed out") == true, "Unexpected error: \(String(describing: result.error))")
        XCTAssertLessThan(elapsedMs, 1500.0)
    }

    func testZeroCocoaOrObjCBridgeExposureAndEphemeralContextIsolation() async {
        let request = ScriptRequestSnapshot(method: "GET", url: "https://api.example.com")

        let firstScript = """
        globalThis.__leakedSecret = "top-secret";
        pm.test("No Cocoa or ObjC bridges exposed", function() {
            pm.expect(typeof ObjC).to.equal("undefined");
            pm.expect(typeof NSFileManager).to.equal("undefined");
            pm.expect(typeof FileManager).to.equal("undefined");
            pm.expect(typeof NSObject).to.equal("undefined");
            pm.expect(typeof Foundation).to.equal("undefined");
            pm.expect(typeof AppKit).to.equal("undefined");
            pm.expect(typeof process).to.equal("undefined");
            pm.expect(typeof require).to.equal("undefined");
        });
        """

        let firstResult = await ScriptRuntime.execute(
            ScriptExecutionInput(script: firstScript, phase: .preRequest, request: request)
        )
        XCTAssertNil(firstResult.error)
        XCTAssertEqual(firstResult.testResults.first?.passed, true)

        let secondScript = """
        pm.test("Fresh ephemeral JSContext has no state from prior execution", function() {
            pm.expect(typeof globalThis.__leakedSecret).to.equal("undefined");
        });
        """

        let secondResult = await ScriptRuntime.execute(
            ScriptExecutionInput(script: secondScript, phase: .preRequest, request: request)
        )
        XCTAssertNil(secondResult.error)
        XCTAssertEqual(secondResult.testResults.first?.passed, true)
    }

    func testReplaceInAndSyntaxErrorReporting() async {
        let request = ScriptRequestSnapshot(method: "GET", url: "https://api.example.com")
        let replaceScript = """
        const resolved = pm.environment.replaceIn("https://{{HOST}}/v1/{{TOKEN}}");
        kb.request.url = resolved;
        """

        let okResult = await ScriptRuntime.execute(
            ScriptExecutionInput(
                script: replaceScript,
                phase: .preRequest,
                request: request,
                variables: ["TOKEN": "abc"],
                environmentVariables: ["HOST": "example.org"]
            )
        )
        XCTAssertNil(okResult.error)
        XCTAssertEqual(okResult.mutatedRequest.url, "https://example.org/v1/abc")

        let badResult = await ScriptRuntime.execute(
            ScriptExecutionInput(script: "const x = ;", phase: .preRequest, request: request)
        )
        XCTAssertNotNil(badResult.error)
        XCTAssertEqual(badResult.mutatedRequest, request)
    }
}
