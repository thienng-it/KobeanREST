import Darwin
import Foundation
import Testing
@testable import KobeanREST

// MARK: - Helpers & Doubles

private func reserveLoopbackPort() throws -> UInt16 {
    let sock = Darwin.socket(AF_INET, SOCK_STREAM, 0)
    guard sock >= 0 else {
        throw POSIXError(.ENOTSOCK)
    }
    defer { Darwin.close(sock) }

    var reuse: Int32 = 1
    setsockopt(sock, SOL_SOCKET, SO_REUSEADDR, &reuse, socklen_t(MemoryLayout<Int32>.size))

    var addr = sockaddr_in()
    addr.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
    addr.sin_family = sa_family_t(AF_INET)
    addr.sin_port = 0
    addr.sin_addr = in_addr(s_addr: inet_addr("127.0.0.1"))

    let bindResult = withUnsafePointer(to: &addr) { ptr in
        ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sockPtr in
            Darwin.bind(sock, sockPtr, socklen_t(MemoryLayout<sockaddr_in>.size))
        }
    }
    guard bindResult == 0 else {
        throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EADDRINUSE)
    }

    var len = socklen_t(MemoryLayout<sockaddr_in>.size)
    let nameResult = withUnsafeMutablePointer(to: &addr) { ptr in
        ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sockPtr in
            Darwin.getsockname(sock, sockPtr, &len)
        }
    }
    guard nameResult == 0 else {
        throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EINVAL)
    }
    return UInt16(bigEndian: addr.sin_port)
}

private actor MockRunnerBridge: CoreBridgeProtocol {
    nonisolated let dataDirectoryURL: URL

    struct Invocation: Sendable {
        let requestId: String
        let method: String
        let url: String
        let variableOverrides: [String: String]
    }

    private let handler: @Sendable (SavedRequest, [String: String]) async throws -> PreparedExecutionResult
    private(set) var invocations: [Invocation] = []
    private(set) var savedVariables: [(env: String, key: String, value: String)] = []
    private(set) var savedSecretVariables: [(env: String, key: String, value: String, scope: String)] = []
    private(set) var deletedVariables: [(env: String, key: String, secretRef: String?)] = []

    init(
        dataDirectoryURL: URL = FileManager.default.temporaryDirectory,
        handler: @escaping @Sendable (SavedRequest, [String: String]) async throws -> PreparedExecutionResult
    ) {
        self.dataDirectoryURL = dataDirectoryURL
        self.handler = handler
    }

    func prepareAndExecuteRequest(
        request: SavedRequest,
        workspace: WorkspaceSummary,
        variableOverrides: [String: String],
        customMethod: String?
    ) async throws -> PreparedExecutionResult {
        invocations.append(
            Invocation(
                requestId: request.id,
                method: customMethod ?? request.method,
                url: request.url,
                variableOverrides: variableOverrides
            )
        )
        return try await handler(request, variableOverrides)
    }

    // MARK: Unused CoreBridgeProtocol Stubs

    func initializePersistence() async throws -> FfiPersistenceStatus {
        FfiPersistenceStatus(databasePath: "", migrated: false)
    }
    func appContract() async -> FfiAppContract {
        FfiAppContract(launchModel: "local-first", accountSystem: "none", offlineReady: true, updateChecks: "disabled")
    }
    func localStorageStatus() async -> FfiLocalStorageStatus {
        FfiLocalStorageStatus(database: "SQLite", secretStorage: "Keychain", exportPolicy: "redacted")
    }
    func requestAuthModes() async -> [String] { ["none"] }
    func loadWorkspace() async throws -> WorkspaceSummary { WorkspaceSummary(id: "ws", name: "Mock") }
    func listWorkspaces() async throws -> [WorkspaceListItem] { [] }
    func loadWorkspace(id: String) async throws -> WorkspaceSummary { WorkspaceSummary(id: id, name: "Mock") }
    func switchWorkspace(id: String) async throws -> WorkspaceSummary { WorkspaceSummary(id: id, name: "Mock") }
    func createWorkspace(name: String) async throws -> String { "ws" }
    func renameWorkspace(id: String, name: String) async throws {}
    func deleteWorkspace(id: String) async throws {}
    func createCollection(name: String, workspaceId: String?) async throws -> String { "col" }
    func updateCollection(id: String, name: String) async throws {}
    func deleteCollection(id: String) async throws {}
    func saveCollectionAuth(id: String, authMode: String, authConfig: AuthConfig) async throws {}
    func createFolder(name: String, collectionId: String?, parentId: String?) async throws -> FolderSummary {
        FolderSummary(id: "f", name: name, collectionId: collectionId, parentId: parentId)
    }
    func updateFolder(id: String, name: String) async throws {}
    func deleteFolder(id: String) async throws {}
    func saveFolderAuth(id: String, authMode: String, authConfig: AuthConfig) async throws {}
    func createRequest(folderId: String) async throws -> SavedRequest { SavedRequest.draft(folderID: folderId) }
    func saveRequest(_ request: SavedRequest) async throws {}
    func deleteRequest(id: String) async throws {}
    func createEnvironment(name: String) async throws -> EnvironmentSummary { EnvironmentSummary(name: name) }
    func renameEnvironment(oldName: String, newName: String) async throws {}
    func deleteEnvironment(name: String) async throws {}
    func setActiveEnvironment(name: String) async throws {}
    func saveVariable(environmentName: String, key: String, value: String, masked: Bool?) async throws {
        savedVariables.append((environmentName, key, value))
    }
    func saveSecretVariable(environmentName: String, key: String, value: String, scope: String) async throws -> String {
        savedSecretVariables.append((environmentName, key, value, scope))
        return "kobeanrest://secrets/\(scope)/\(key)"
    }
    func deleteVariable(environmentName: String, key: String, secretRef: String?) async throws {
        deletedVariables.append((environmentName, key, secretRef))
    }
    func storeSecret(scope: String, key: String, value: String) async throws -> String { "" }
    func resolveSecrets(refIds: [String]) async throws -> [String: String] { [:] }
    func deleteSecret(refId: String) async throws {}
    func loadRequestHistory() async throws -> [HistoryEntry] { [] }
    func loadHistoryResponse(id: Int64) async throws -> HistoryResponsePayload { HistoryResponsePayload() }
    func recordRequestHistory(_ entry: RequestHistoryEntry) async throws {}
    func clearRequestHistory() async throws {}
    func redactUrlForHistory(_ url: String, authMode: String, authConfig: AuthConfig) async throws -> String { url }
    func redactHeadersForHistory(_ headers: [HeaderEntry], authMode: String, authConfig: AuthConfig) async throws -> [HeaderEntry] {
        CoreBridge.sanitizeHeadersForHistory(headers, apiKeyHeaderName: authMode == "apiKey" ? authConfig.keyName : nil)
    }
    func loadAppSettings() async throws -> AppSettings { .default }
    func saveAppSettings(_ settings: AppSettings) async throws {}
    func extractPathVariables(url: String) async -> [String] { [] }
    func syncPathVariables(url: String, existing: [PathVariableEntry]?) async throws -> [PathVariableEntry] { [] }
    func detectImportFormat(content: String) async -> String { "unknown" }
    func parseUniversalImport(content: String, defaultWorkspaceName: String?) async throws -> NormalizedImportResult {
        NormalizedImportResult(format: "unknown", formatLabel: "Unknown", title: "", stats: ImportStats(), exportDataJson: "{}")
    }
    func parseCurlCommand(raw: String) async throws -> CurlImportResult {
        try JSONDecoder().decode(CurlImportResult.self, from: Data("{}".utf8))
    }
    func importWorkspaceData(json: String) async throws {}
    func exportWorkspaceData() async throws -> String { "{}" }
    func resolveEnvironmentSecretValues(workspace: WorkspaceSummary) async -> [String: String] { [:] }
    func buildScopedVariableMap(request: SavedRequest, workspace: WorkspaceSummary) async throws -> [String: String] { [:] }
    func getScripts(entityId: String, entityType: String) async throws -> [ScriptRecord] { [] }
    func getAllScripts() async throws -> [ScriptRecord] { [] }
    func saveScript(entityId: String, entityType: String, scriptType: String, content: String) async throws {}
    func deleteScript(scriptId: String) async throws {}
}

// MARK: - Test Suite

@Suite("Phase 3 Views & ViewModels")
struct Phase3ViewsTests {
    @Test("MockServerViewModel round-trips routes, serves HTTP loopback traffic, and logs requests")
    @MainActor
    func mockServerRoundTripAndLoopbackHit() async throws {
        let port = try reserveLoopbackPort()
        let viewModel = MockServerViewModel()
        viewModel.portText = String(port)

        let route = MockRouteItem(
            id: "route-hello",
            method: "GET",
            path: "/hello",
            statusCode: 200,
            responseBody: #"{"greeting":"kobean"}"#,
            contentType: "application/json",
            delayMs: 0,
            enabled: true
        )

        await viewModel.setRoutes([route])
        await viewModel.loadRoutes()
        #expect(viewModel.routes.count == 1)
        #expect(viewModel.routes.first?.path == "/hello")

        await viewModel.startServer()
        #expect(viewModel.isRunning == true)
        #expect(viewModel.activePort == port)

        do {
            let url = URL(string: "http://127.0.0.1:\(port)/hello")!
            let (data, urlResponse) = try await URLSession.shared.data(from: url)
            let http = urlResponse as? HTTPURLResponse
            #expect(http?.statusCode == 200)
            #expect(String(data: data, encoding: .utf8) == #"{"greeting":"kobean"}"#)

            await viewModel.refreshRequestLog()
            #expect(viewModel.requestLog.count == 1)
            let log = try #require(viewModel.requestLog.first)
            #expect(log.method == "GET")
            #expect(log.path == "/hello")
            #expect(log.statusCode == 200)
            #expect(log.matchedRouteId == "route-hello")

            await viewModel.clearRequestLog()
            #expect(viewModel.requestLog.isEmpty)

            await viewModel.stopServer()
            #expect(viewModel.isRunning == false)
        } catch {
            await viewModel.stopServer()
            throw error
        }
    }

    @Test("SnippetRequestInput mapping resolves custom methods, query params, headers, and redaction")
    func snippetRequestInputMapping() throws {
        var request = SavedRequest(
            id: "req-snip",
            name: "Purge Cache",
            method: HTTPMethod.custom.rawValue,
            url: "https://api.example.com/v1/cache",
            headers: [
                HeaderEntry(key: "Authorization", value: "Bearer top-secret-token", enabled: true),
                HeaderEntry(key: "Accept", value: "application/json", enabled: true),
                HeaderEntry(key: "X-Disabled", value: "ignored", enabled: false),
            ],
            body: #"{"purgeAll":true}"#,
            bodyMimeType: BodyMimeType.json.rawValue
        )
        request.setQueryParams([
            HeaderEntry(key: "region", value: "us-east", enabled: true),
            HeaderEntry(key: "debug", value: "1", enabled: false),
        ])

        let input = SnippetSheetView.makeSnippetInput(request: request, customMethod: "purge")
        #expect(input.method == "PURGE")
        #expect(input.url == "https://api.example.com/v1/cache?region=us-east")
        #expect(input.headers.count == 3)
        #expect(input.body == #"{"purgeAll":true}"#)
        #expect(input.bodyMimeType == "application/json")

        let redactedCurl = SnippetGenerator.generate(input, language: .curl, redactSensitiveHeaders: true)
        #expect(redactedCurl.contains("PURGE"))
        #expect(redactedCurl.contains(SnippetGenerator.redactedPlaceholder))
        #expect(!redactedCurl.contains("top-secret-token"))
        #expect(!redactedCurl.contains("X-Disabled"))

        let unredactedCurl = SnippetGenerator.generate(input, language: .curl, redactSensitiveHeaders: false)
        #expect(unredactedCurl.contains("top-secret-token"))

        for language in SnippetLanguage.allCases {
            let output = SnippetGenerator.generate(input, language: language, redactSensitiveHeaders: true)
            #expect(!output.isEmpty)
            #expect(!output.contains("top-secret-token"))
        }

        let noBodyRequest = SavedRequest(
            id: "req-get",
            name: "Get",
            method: "GET",
            url: "https://api.example.com/health",
            body: "should-be-omitted",
            bodyMimeType: BodyMimeType.none.rawValue
        )
        let noBodyInput = SnippetSheetView.makeSnippetInput(request: noBodyRequest, customMethod: nil)
        #expect(noBodyInput.body == nil)
        #expect(noBodyInput.bodyMimeType == nil)
    }

    @Test("CollectionRunnerViewModel executes collection requests, runs assertions, and propagates variables")
    @MainActor
    func collectionRunnerSequentialExecutionAndAssertions() async throws {
        let collection = CollectionSummary(id: "col-1", name: "Users API")
        let otherCollection = CollectionSummary(id: "col-2", name: "Billing API")
        let folder = FolderSummary(id: "folder-1", name: "Core", collectionId: "col-1")
        let subfolder = FolderSummary(id: "folder-2", name: "Nested", collectionId: nil, parentId: "folder-1")

        let req1 = SavedRequest(id: "req-1", name: "Login", method: "POST", url: "https://api.example.com/login", folderId: "folder-1")
        let req2 = SavedRequest(id: "req-2", name: "Profile", method: "GET", url: "https://api.example.com/me", folderId: "folder-2")
        let reqOther = SavedRequest(id: "req-3", name: "Invoice", method: "GET", url: "https://api.example.com/invoice", folderId: "col-2")

        let workspace = WorkspaceSummary(
            id: "ws-1",
            name: "Test Workspace",
            folders: [folder, subfolder],
            requests: [req1, req2, reqOther],
            collections: [collection, otherCollection]
        )

        let scripts: [PersistedScriptEntry] = [
            PersistedScriptEntry(
                id: "s1",
                entityId: "req-1",
                entityType: "request",
                scriptType: "post_request",
                content: """
                pm.environment.set("AUTH_TOKEN", "tok-abc");
                pm.test("login returns 200", function () {
                    pm.expect(pm.response.code).to.equal(200);
                });
                """,
                position: 0
            ),
            PersistedScriptEntry(
                id: "s2",
                entityId: "req-2",
                entityType: "request",
                scriptType: "post_request",
                content: """
                pm.test("expects 200 ok", function () {
                    pm.expect(pm.response.code).to.equal(200);
                });
                """,
                position: 0
            ),
        ]

        let bridge = MockRunnerBridge { request, _ in
            if request.id == "req-1" {
                return PreparedExecutionResult(
                    prepared: PreparedHttpRequest(method: request.method, url: request.url),
                    response: ExecuteHttpResponse(status: 200, statusText: "OK", bodyText: #"{"ok":true}"#, durationMs: 12)
                )
            }
            return PreparedExecutionResult(
                prepared: PreparedHttpRequest(method: request.method, url: request.url),
                response: ExecuteHttpResponse(status: 500, statusText: "Server Error", bodyText: #"{"err":true}"#, durationMs: 18)
            )
        }

        let viewModel = CollectionRunnerViewModel(
            bridge: bridge,
            workspace: workspace,
            scriptLoader: { _ in scripts }
        )

        viewModel.selectedCollectionID = "col-1"
        viewModel.rebuildQueue()
        #expect(viewModel.results.count == 2)

        await viewModel.runAndWaitForTesting()

        #expect(viewModel.completedCount == 2)
        #expect(viewModel.passedCount == 1)
        #expect(viewModel.failedCount == 1)
        #expect(viewModel.totalAssertionsPassed == 1)
        #expect(viewModel.totalAssertionsFailed == 1)
        #expect(viewModel.results[0].status == .passed)
        #expect(viewModel.results[0].httpStatus == 200)
        #expect(viewModel.results[1].status == .failed)
        #expect(viewModel.results[1].httpStatus == 500)

        let invocations = await bridge.invocations
        #expect(invocations.count == 2)
        #expect(invocations[1].variableOverrides["AUTH_TOKEN"] == "tok-abc")
    }

    @Test("CollectionRunnerViewModel stops on failure when stopOnFailure is enabled")
    @MainActor
    func collectionRunnerStopOnFailure() async {
        let req1 = SavedRequest(id: "req-1", name: "First Fails", method: "GET", url: "https://api.example.com/1")
        let req2 = SavedRequest(id: "req-2", name: "Should Skip", method: "GET", url: "https://api.example.com/2")
        let workspace = WorkspaceSummary(id: "ws-1", name: "Test", requests: [req1, req2])

        let bridge = MockRunnerBridge { request, _ in
            PreparedExecutionResult(
                prepared: PreparedHttpRequest(method: request.method, url: request.url),
                response: ExecuteHttpResponse(status: 503, statusText: "Unavailable", durationMs: 5)
            )
        }

        let viewModel = CollectionRunnerViewModel(
            bridge: bridge,
            workspace: workspace,
            scriptLoader: { _ in [] }
        )
        viewModel.stopOnFailure = true

        await viewModel.runAndWaitForTesting()

        #expect(viewModel.completedCount == 1)
        #expect(viewModel.failedCount == 1)
        #expect(viewModel.results[0].status == .failed)
        #expect(viewModel.results[1].status == .skipped)
        let invocations = await bridge.invocations
        #expect(invocations.count == 1)
    }

    @Test("CollectionRunnerViewModel executes pre/post script types, persists non-secret/secret env safely, and preserves custom methods")
    @MainActor
    func collectionRunnerNormalizedScriptTypesAndEnvPersistence() async {
        let req1 = SavedRequest(id: "req-1", name: "Purge", method: "GET", url: "https://api.example.com/cache")
        let workspace = WorkspaceSummary(
            id: "ws-1",
            name: "Test",
            activeEnvironment: "Dev",
            environments: [
                EnvironmentSummary(
                    name: "Dev",
                    variables: [
                        EnvironmentVariable(key: "PUBLIC_FLAG", value: "off", secret: false),
                        EnvironmentVariable(
                            key: "SECRET_TOKEN",
                            value: EnvironmentVariable.redactedPlaceholder,
                            secret: true,
                            secretRef: "kobeanrest://secrets/env-Dev/SECRET_TOKEN"
                        ),
                    ]
                )
            ],
            requests: [req1]
        )

        let scripts: [PersistedScriptEntry] = [
            PersistedScriptEntry(
                id: "s-pre",
                entityId: "req-1",
                entityType: "request",
                scriptType: "pre",
                content: """
                pm.request.method = "PURGE";
                pm.environment.set("PUBLIC_FLAG", "on");
                pm.environment.set("SECRET_TOKEN", "rotated-secret");
                """,
                position: 0
            ),
            PersistedScriptEntry(
                id: "s-post",
                entityId: "req-1",
                entityType: "request",
                scriptType: "post",
                content: """
                pm.test("no secret exposed in pm.environment", function () {
                    pm.expect(pm.environment.get("SECRET_TOKEN")).to.be.undefined;
                });
                """,
                position: 0
            ),
        ]

        let bridge = MockRunnerBridge { request, _ in
            PreparedExecutionResult(
                prepared: PreparedHttpRequest(method: "PURGE", url: request.url),
                response: ExecuteHttpResponse(status: 200, statusText: "OK", durationMs: 5)
            )
        }

        let viewModel = CollectionRunnerViewModel(
            bridge: bridge,
            workspace: workspace,
            scriptLoader: { _ in scripts }
        )

        await viewModel.runAndWaitForTesting()

        #expect(viewModel.passedCount == 1)
        #expect(viewModel.failedCount == 0)
        #expect(viewModel.totalAssertionsPassed == 1)
        let invocations = await bridge.invocations
        #expect(invocations.count == 1)
        #expect(invocations[0].method == "PURGE")

        let savedVars = await bridge.savedVariables
        let hasPublicFlag = savedVars.contains { $0.env == "Dev" && $0.key == "PUBLIC_FLAG" && $0.value == "on" }
        let leakedSecretVar = savedVars.contains { $0.key == "SECRET_TOKEN" }
        #expect(hasPublicFlag)
        #expect(!leakedSecretVar)

        let savedSecrets = await bridge.savedSecretVariables
        let hasRotatedSecret = savedSecrets.contains { $0.env == "Dev" && $0.key == "SECRET_TOKEN" && $0.value == "rotated-secret" }
        #expect(hasRotatedSecret)
    }

    @Test("MockServerViewModel.importRoutes walks descendant folders for collection import and does not fall back to all requests")
    @MainActor
    func mockServerImportWalksDescendantFolders() async {
        let col1Folders = [
            FolderSummary(id: "f-root", name: "Root", collectionId: "col-1"),
            FolderSummary(id: "f-nested", name: "Nested", collectionId: nil, parentId: "f-root"),
            FolderSummary(id: "f-other", name: "Other", collectionId: "col-2"),
        ]
        let requests = [
            SavedRequest(id: "r1", name: "Users", method: "GET", url: "https://api.example.com/users", folderId: "f-root"),
            SavedRequest(id: "r2", name: "Profile", method: "POST", url: "https://api.example.com/profile", folderId: "f-nested"),
            SavedRequest(id: "r3", name: "Billing", method: "GET", url: "https://api.example.com/billing", folderId: "f-other"),
        ]

        let viewModel = MockServerViewModel()
        await viewModel.importRoutes(from: requests, folders: col1Folders, collectionId: "col-1")
        #expect(viewModel.routes.count == 2)
        #expect(viewModel.routes.contains(where: { $0.path == "/users" && $0.method == "GET" }))
        #expect(viewModel.routes.contains(where: { $0.path == "/profile" && $0.method == "POST" }))
        #expect(!viewModel.routes.contains(where: { $0.path == "/billing" }))

        // Empty collection must not fall back to all workspace requests
        let emptyVM = MockServerViewModel()
        await emptyVM.importRoutes(from: requests, folders: col1Folders, collectionId: "col-empty")
        #expect(emptyVM.routes.isEmpty)
    }
}
