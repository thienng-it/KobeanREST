import Foundation
import Testing
@testable import KobeanREST

@Suite("CoreBridge & Models")
struct CoreBridgeTests {
    private func makeTempDir() throws -> URL {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("kobeanrest-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    @Test("Default data directory matches Tauri macOS Application Support path")
    func defaultDataDirectoryMatchesTauri() {
        let url = CoreBridge.defaultDataDirectoryURL
        #expect(url.lastPathComponent == "com.kobeanrest.app")
        #expect(url.path.contains("Application Support/com.kobeanrest.app"))
    }

    @Test("Initialize persistence creates kobeanrest.sqlite and round-trips collection/folder/request")
    func persistenceAndCrudRoundTrip() async throws {
        let tempDir = try makeTempDir()
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let bridge = CoreBridge(dataDirectoryURL: tempDir)
        let status = try await bridge.initializePersistence()
        #expect(status.databasePath.hasSuffix("kobeanrest.sqlite"))
        #expect(FileManager.default.fileExists(atPath: status.databasePath))

        let initialWorkspace = try await bridge.loadWorkspace()
        #expect(!initialWorkspace.id.isEmpty)

        let collectionId = try await bridge.createCollection(
            name: "Swift Native API",
            workspaceId: initialWorkspace.id
        )
        let folder = try await bridge.createFolder(
            name: "Users",
            collectionId: collectionId,
            parentId: nil
        )
        var createdRequest = try await bridge.createRequest(folderId: folder.id)
        createdRequest.name = "Get User"
        createdRequest.method = "GET"
        createdRequest.url = "https://api.example.com/users/:id"
        createdRequest.headers = [HeaderEntry(key: "Accept", value: "application/json", enabled: true)]
        try await bridge.saveRequest(createdRequest)

        let reloaded = try await bridge.loadWorkspace()
        #expect(reloaded.collections?.contains(where: { $0.id == collectionId && $0.name == "Swift Native API" }) == true)
        #expect(reloaded.folders.contains(where: { $0.id == folder.id && $0.name == "Users" }))
        let matched = reloaded.requests.first(where: { $0.id == createdRequest.id })
        #expect(matched?.name == "Get User")
        #expect(matched?.url == "https://api.example.com/users/:id")
        #expect(matched?.headers.first?.key == "Accept")
    }

    @Test("Secret variable stores outside SQLite and returns redacted placeholder")
    func secretVariableRedactionInSQLite() async throws {
        let tempDir = try makeTempDir()
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let bridge = CoreBridge(dataDirectoryURL: tempDir)
        _ = try await bridge.initializePersistence()
        _ = try await bridge.createEnvironment(name: "NativeTestEnv")

        let secretScope = "test-\(UUID().uuidString.lowercased())"
        let secretValue = "super-secret-token-\(UUID().uuidString)"
        let refId = try await bridge.saveSecretVariable(
            environmentName: "NativeTestEnv",
            key: "API_TOKEN",
            value: secretValue,
            scope: secretScope
        )
        do {
            #expect(refId.hasPrefix("kobeanrest://secrets/"))

            let workspace = try await bridge.loadWorkspace()
            let env = workspace.environments.first(where: { $0.name == "NativeTestEnv" })
            let variable = env?.variables.first(where: { $0.key == "API_TOKEN" })
            #expect(variable?.secret == true)
            #expect(variable?.secretRef == refId)
            #expect(variable?.value == EnvironmentVariable.redactedPlaceholder)
            #expect(variable?.value != secretValue)

            let resolved = try await bridge.resolveSecrets(refIds: [refId])
            #expect(resolved[refId] == secretValue)
            try? await bridge.deleteSecret(refId: refId)
        } catch {
            try? await bridge.deleteSecret(refId: refId)
            throw error
        }
    }

    @Test("Domain helpers extract path variables and parse cURL imports")
    func domainHelpersRoundTrip() async throws {
        let tempDir = try makeTempDir()
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let bridge = CoreBridge(dataDirectoryURL: tempDir)
        let vars = await bridge.extractPathVariables(url: "https://api.example.com/{{version}}/orgs/:orgId/repos/{repoId}")
        #expect(vars == ["orgId", "repoId"])

        let curlInput = "curl -X POST https://api.example.com/items -H 'Content-Type: application/json' -d '{\"ok\":true}'"
        let format = await bridge.detectImportFormat(content: curlInput)
        #expect(format == "curl")

        let parsedCurl = try await bridge.parseCurlCommand(raw: curlInput)
        #expect(parsedCurl.method == "POST")
        #expect(parsedCurl.url == "https://api.example.com/items")
        #expect(parsedCurl.headers.contains(where: { $0.key == "Content-Type" && $0.value == "application/json" }))
    }

    @Test("KobeanModels defensively decodes optional and null Rust JSON fields")
    func defensiveJsonDecoding() throws {
        let workspaceJson = """
        {
          "id": "ws-1",
          "name": "Default",
          "activeEnvironment": "",
          "environments": [],
          "folders": [],
          "collections": null,
          "requests": [
            {
              "id": "req-1",
              "name": "Health",
              "method": "GET",
              "url": "https://example.com/health",
              "folderId": "col-1",
              "authMode": "none",
              "authConfig": "{}",
              "headers": [],
              "queryParams": "[]",
              "body": "",
              "bodyMimeType": "text/plain",
              "bodyForm": "[]",
              "timeoutMs": 30000,
              "followRedirects": true,
              "examples": null,
              "pathVariables": null
            }
          ]
        }
        """
        let data = Data(workspaceJson.utf8)
        let decoded = try JSONDecoder().decode(WorkspaceSummary.self, from: data)
        #expect(decoded.id == "ws-1")
        #expect(decoded.collections == nil)
        #expect(decoded.requests.count == 1)
        #expect(decoded.requests[0].examples == nil)
        #expect(decoded.requests[0].pathVariables == nil)

        let responseJson = """
        {
          "status": 200,
          "statusText": "200 OK",
          "headers": [{"key": "content-type", "value": "application/json", "enabled": true, "type": null}],
          "bodyText": "{\\"b\\":1,\\"a\\":2}",
          "bodyBase64": null,
          "durationMs": 42,
          "dnsMs": 3,
          "connectMs": 10,
          "tlsMs": 12,
          "requestMs": 17,
          "sizeBytes": 13,
          "contentType": "application/json"
        }
        """
        let resp = try JSONDecoder().decode(ExecuteHttpResponse.self, from: Data(responseJson.utf8))
        #expect(resp.status == 200)
        #expect(resp.durationMs == 42)
        #expect(resp.prettyPrintedBody.contains("\n"))
    }

    @Test("AppState manages multi-tab lifecycle and dirty tracking")
    @MainActor
    func appStateTabLifecycle() async {
        let mockBridge = MockCoreBridge()
        let state = AppState(bridge: mockBridge)
        await state.bootstrap()

        #expect(state.tabs.count == 1)
        let firstTabID = state.selectedTabID
        #expect(firstTabID != nil)
        #expect(state.activeTab?.isDirty == false)

        state.updateActiveRequest { $0.url = "https://example.com/v2" }
        #expect(state.activeTab?.isDirty == true)

        let secondTabID = state.createNewTab()
        #expect(state.tabs.count == 2)
        #expect(state.selectedTabID == secondTabID)

        state.closeTab(id: secondTabID)
        #expect(state.tabs.count == 1)
        #expect(state.selectedTabID == firstTabID)
    }

    @Test("CoreBridge saveScript and getScripts round-trip and delete cleanly")
    func scriptPersistenceRoundTrip() async throws {
        let tempDir = try makeTempDir()
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let bridge = CoreBridge(dataDirectoryURL: tempDir)
        _ = try await bridge.initializePersistence()
        let workspace = try await bridge.loadWorkspace()
        let folderId = workspace.folders.first?.id ?? ""
        let request = try await bridge.createRequest(folderId: folderId)

        try await bridge.saveScript(
            entityId: request.id,
            entityType: "request",
            scriptType: "pre",
            content: "kb.request.setHeader('X-Test', '1');"
        )
        try await bridge.saveScript(
            entityId: request.id,
            entityType: "request",
            scriptType: "post",
            content: "pm.test('ok', () => pm.expect(200).to.equal(200));"
        )
        // Updating same scriptType overwrites existing record instead of duplicating.
        try await bridge.saveScript(
            entityId: request.id,
            entityType: "request",
            scriptType: "pre",
            content: "kb.request.setHeader('X-Test', '2');"
        )

        let scripts = try await bridge.getScripts(entityId: request.id, entityType: "request")
        #expect(scripts.count == 2)
        let pre = scripts.first(where: { $0.scriptType == "pre" })
        let post = scripts.first(where: { $0.scriptType == "post" })
        #expect(pre?.content == "kb.request.setHeader('X-Test', '2');")
        #expect(post?.content.contains("pm.test") == true)

        let all = try await bridge.getAllScripts()
        #expect(all.contains(where: { $0.entityId == request.id && $0.scriptType == "pre" }))

        if let preId = pre?.id {
            try await bridge.deleteScript(scriptId: preId)
            let remaining = try await bridge.getScripts(entityId: request.id, entityType: "request")
            #expect(remaining.count == 1)
            #expect(remaining.first?.scriptType == "post")
        }
    }

    @Test("AppState executes pre/post scripts on send and validates OAuth2 state")
    @MainActor
    func appStateScriptPipelineAndOAuth2Checks() async throws {
        let mockBridge = MockCoreBridge()
        let state = AppState(bridge: mockBridge)
        await state.bootstrap()

        guard let tabID = state.selectedTabID else {
            Issue.record("Expected an active tab after bootstrap")
            return
        }

        state.updateTab(id: tabID) { tab in
            tab.preScript = """
            kb.request.setHeader("X-Script-Header", "enabled");
            console.log("pre-script ran");
            """
            tab.postScript = """
            pm.test("Status is 200", function() {
                pm.expect(pm.response.code).to.equal(200);
            });
            console.log("post-script ran");
            """
            tab.isDirty = true
        }

        await state.saveActiveTab()
        let savedScripts = try await mockBridge.getScripts(entityId: "req-1", entityType: "request")
        #expect(savedScripts.count == 2)

        state.sendActiveTab()
        // Wait for async send task to complete.
        for _ in 0..<50 {
            if case .success = state.activeTab?.responseState {
                break
            }
            try await Task.sleep(for: .milliseconds(20))
        }

        guard case .success = state.activeTab?.responseState else {
            Issue.record("Expected .success response state")
            return
        }
        #expect(mockBridge.lastPreparedRequest?.headers.contains(where: { $0.key == "X-Script-Header" && $0.value == "enabled" }) == true)
        #expect(state.activeTab?.testResults.count == 1)
        #expect(state.activeTab?.testResults.first?.passed == true)
        #expect(state.activeTab?.scriptLogs.count == 2)

        // OAuth2 missing configuration validation resets authorizing flag cleanly.
        state.updateActiveRequest { req in
            req.authMode = AuthMode.oauth2.rawValue
            req.setAuthConfig(AuthConfig(grantType: "authorization_code"))
        }
        await state.authorizeOAuth2ForActiveTab()
        #expect(state.isAuthorizingOAuth == false)
        #expect(state.statusMessage?.contains("Access Token URL") == true)

        await state.refreshOAuth2ForActiveTab()
        #expect(state.isAuthorizingOAuth == false)
        #expect(state.statusMessage?.contains("Access Token URL") == true)
    }

    @Test("T-01/T-02 AuthConfig secrets externalize to Keychain before save and fail closed on Keychain errors")
    @MainActor
    func authSecretsExternalizeBeforeSaveAndFailCleanly() async throws {
        let mockBridge = MockCoreBridge()
        let state = AppState(bridge: mockBridge)
        await state.bootstrap()

        // 1. Plaintext secrets are externalized before saving
        state.updateActiveRequest { req in
            req.authMode = AuthMode.oauth2.rawValue
            req.setAuthConfig(AuthConfig(
                password: "basic-password-raw",
                token: "access-token-raw",
                keyValue: "api-key-raw",
                clientSecret: "client-secret-raw",
                refreshToken: "refresh-token-raw"
            ))
        }
        await state.saveActiveTab()

        let savedReq = try #require(mockBridge.lastSavedRequest)
        let savedCfg = savedReq.decodedAuthConfig
        #expect(savedCfg.token?.hasPrefix("kobeanrest://secrets/auth-req-1/token") == true)
        #expect(savedCfg.refreshToken?.hasPrefix("kobeanrest://secrets/auth-req-1/refreshToken") == true)
        #expect(savedCfg.clientSecret?.hasPrefix("kobeanrest://secrets/auth-req-1/clientSecret") == true)
        #expect(savedCfg.password?.hasPrefix("kobeanrest://secrets/auth-req-1/password") == true)
        #expect(savedCfg.keyValue?.hasPrefix("kobeanrest://secrets/auth-req-1/keyValue") == true)

        #expect(mockBridge.storedSecrets[savedCfg.token ?? ""] == "access-token-raw")
        #expect(mockBridge.storedSecrets[savedCfg.refreshToken ?? ""] == "refresh-token-raw")
        #expect(mockBridge.storedSecrets[savedCfg.clientSecret ?? ""] == "client-secret-raw")
        #expect(mockBridge.storedSecrets[savedCfg.password ?? ""] == "basic-password-raw")
        #expect(mockBridge.storedSecrets[savedCfg.keyValue ?? ""] == "api-key-raw")

        // 2. Variable templates and redacted placeholders are preserved untouched
        state.updateActiveRequest { req in
            req.setAuthConfig(AuthConfig(
                password: "{{ENV_PASS}}",
                token: EnvironmentVariable.redactedPlaceholder,
                clientSecret: savedCfg.clientSecret
            ))
        }
        await state.saveActiveTab()
        let templateSavedCfg = try #require(mockBridge.lastSavedRequest?.decodedAuthConfig)
        #expect(templateSavedCfg.password == "{{ENV_PASS}}")
        #expect(templateSavedCfg.token == EnvironmentVariable.redactedPlaceholder)
        #expect(templateSavedCfg.clientSecret == savedCfg.clientSecret)

        // 3. Keychain storage error fails cleanly without persisting plaintext to SQLite
        mockBridge.shouldThrowOnStoreSecret = true
        let saveCountBeforeFailure = mockBridge.saveRequestCallCount
        state.updateActiveRequest { req in
            req.setAuthConfig(AuthConfig(token: "plaintext-must-not-hit-sqlite"))
        }
        await state.saveActiveTab()
        #expect(mockBridge.saveRequestCallCount == saveCountBeforeFailure)
        #expect(state.statusMessage?.contains("Save failed") == true)
        #expect(state.activeTab?.isDirty == true)
    }

    @Test("T-01/T-02 CoreBridge.prepareAndExecuteRequest fails closed on missing Keychain auth secret")
    func coreBridgeFailsClosedOnMissingAuthSecret() async throws {
        let tempDir = try makeTempDir()
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let bridge = CoreBridge(dataDirectoryURL: tempDir)
        _ = try await bridge.initializePersistence()

        var request = SavedRequest(
            id: "req-missing-secret",
            name: "Auth Fail Closed",
            method: "GET",
            url: "https://127.0.0.1:1/protected"
        )
        request.authMode = AuthMode.bearer.rawValue
        request.setAuthConfig(AuthConfig(
            token: "kobeanrest://secrets/auth-req-missing/nonexistent-\(UUID().uuidString)"
        ))

        let workspace = WorkspaceSummary(id: "ws-1", name: "Test")
        do {
            _ = try await bridge.prepareAndExecuteRequest(
                request: request,
                workspace: workspace
            )
            Issue.record("Expected CoreBridge.prepareAndExecuteRequest to fail closed on missing Keychain secret")
        } catch let error as CoreBridgeError {
            guard case .missingSecret = error else {
                Issue.record("Expected CoreBridgeError.missingSecret, got \(error)")
                return
            }
        }
    }

    @Test("T-01/T-02 AppState.refreshOAuth2ForActiveTab resolves Keychain refs, fails closed if missing, and re-externalizes")
    @MainActor
    func oauthRefreshResolvesKeychainSecretsAndReExternalizes() async throws {
        let mockBridge = MockCoreBridge()
        let transport = TestOAuthHTTPTransport { _ in
            let body = #"{"access_token":"refreshed_access_tok","refresh_token":"refreshed_refresh_tok","expires_in":3600}"#
            let resp = HTTPURLResponse(
                url: URL(string: "https://auth.example.com/token")!,
                statusCode: 200,
                httpVersion: "HTTP/1.1",
                headerFields: ["Content-Type": "application/json"]
            )!
            return (Data(body.utf8), resp)
        }
        let oauthService = OAuthSessionService(httpTransport: transport)
        let state = AppState(bridge: mockBridge, oauthService: oauthService)
        await state.bootstrap()

        let clientSecretRef = try await mockBridge.storeSecret(
            scope: "auth-req-1",
            key: "clientSecret",
            value: "keychain-client-secret"
        )
        let refreshRef = try await mockBridge.storeSecret(
            scope: "auth-req-1",
            key: "refreshToken",
            value: "keychain-refresh-token"
        )

        state.updateActiveRequest { req in
            req.authMode = AuthMode.oauth2.rawValue
            req.setAuthConfig(AuthConfig(
                grantType: "authorization_code",
                accessTokenUrl: "https://auth.example.com/token",
                clientId: "cid-123",
                clientSecret: clientSecretRef,
                refreshToken: refreshRef
            ))
        }

        await state.refreshOAuth2ForActiveTab()
        #expect(state.statusMessage == "OAuth 2.0 token refreshed.")

        let updatedCfg = try #require(state.activeTab?.request.decodedAuthConfig)
        #expect(updatedCfg.token?.hasPrefix("kobeanrest://secrets/auth-req-1/token") == true)
        #expect(updatedCfg.refreshToken?.hasPrefix("kobeanrest://secrets/auth-req-1/refreshToken") == true)
        #expect(mockBridge.storedSecrets[updatedCfg.token ?? ""] == "refreshed_access_tok")
        #expect(mockBridge.storedSecrets[updatedCfg.refreshToken ?? ""] == "refreshed_refresh_tok")

        // Fail closed when Keychain secret ref resolves missing
        state.updateActiveRequest { req in
            req.setAuthConfig(AuthConfig(
                grantType: "authorization_code",
                accessTokenUrl: "https://auth.example.com/token",
                clientId: "cid-123",
                clientSecret: clientSecretRef,
                refreshToken: "kobeanrest://secrets/auth-req-1/missing-refresh"
            ))
        }
        await state.refreshOAuth2ForActiveTab()
        #expect(state.statusMessage?.contains("OAuth 2.0 refresh failed") == true)
    }

    @Test("T-03 & T-05 Scripts cannot read Keychain secrets and RequestHistoryEntry redacts headers and query tokens")
    @MainActor
    func scriptSecretIsolationAndHistoryRedaction() async throws {
        let mockBridge = MockCoreBridge()
        mockBridge.workspaceOverride = WorkspaceSummary(
            id: "ws-mock",
            name: "Mock Workspace",
            activeEnvironment: "Prod",
            environments: [
                EnvironmentSummary(
                    name: "Prod",
                    variables: [
                        EnvironmentVariable(key: "PUBLIC_URL", value: "https://api.example.com", secret: false),
                        EnvironmentVariable(
                            key: "API_SECRET",
                            value: EnvironmentVariable.redactedPlaceholder,
                            secret: true,
                            secretRef: "kobeanrest://secrets/env-Prod/API_SECRET"
                        ),
                    ]
                )
            ],
            requests: [
                SavedRequest(
                    id: "req-1",
                    name: "Ping",
                    method: "GET",
                    url: "https://api.example.com/ping?token=tok123&api_key=ak123&client_secret=cs123&ok=1"
                )
            ]
        )
        mockBridge.environmentSecretsOverride = ["API_SECRET": "top-secret-keychain-value"]
        mockBridge.responseHeadersOverride = [
            HeaderEntry(key: "Set-Cookie", value: "session=secret-cookie", enabled: true),
            HeaderEntry(key: "Authorization", value: "Bearer secret-bearer", enabled: true),
            HeaderEntry(key: "Proxy-Authorization", value: "Basic secret-proxy", enabled: true),
            HeaderEntry(key: "X-API-Key", value: "sk_live_secret", enabled: true),
            HeaderEntry(key: "Content-Type", value: "application/json", enabled: true),
        ]

        let state = AppState(bridge: mockBridge)
        await state.bootstrap()

        guard let tabID = state.selectedTabID else {
            Issue.record("Expected active tab")
            return
        }

        state.updateTab(id: tabID) { tab in
            tab.preScript = """
            console.log("ENV_JSON=" + JSON.stringify(pm.environment.toObject()));
            """
        }
        state.sendActiveTab()

        for _ in 0..<50 {
            if case .success = state.activeTab?.responseState {
                break
            }
            try await Task.sleep(for: .milliseconds(20))
        }

        // T-03: Keychain secret must NOT appear in pm.environment inside ScriptRuntime
        let logs = state.activeTab?.scriptLogs.map(\.message).joined(separator: "\n") ?? ""
        #expect(logs.contains("PUBLIC_URL"))
        #expect(!logs.contains("API_SECRET"))
        #expect(!logs.contains("top-secret-keychain-value"))

        // T-05: History entry must redact sensitive headers & query params
        let recorded = try #require(mockBridge.lastRecordedHistory)
        #expect(!recorded.url.contains("tok123"))
        #expect(!recorded.url.contains("ak123"))
        #expect(!recorded.url.contains("cs123"))
        #expect(recorded.url.contains("token=[redacted]"))
        #expect(recorded.url.contains("api_key=[redacted]"))
        #expect(recorded.url.contains("client_secret=[redacted]"))
        #expect(recorded.url.contains("ok=1"))

        let recordedHeadersData = try #require(recorded.responseHeaders?.data(using: .utf8))
        let recordedHeaders = try JSONDecoder().decode([HeaderEntry].self, from: recordedHeadersData)
        #expect(recordedHeaders.first(where: { $0.key == "Set-Cookie" })?.value == "[redacted]")
        #expect(recordedHeaders.first(where: { $0.key == "Authorization" })?.value == "[redacted]")
        #expect(recordedHeaders.first(where: { $0.key == "Proxy-Authorization" })?.value == "[redacted]")
        #expect(recordedHeaders.first(where: { $0.key == "X-API-Key" })?.value == "[redacted]")
        #expect(recordedHeaders.first(where: { $0.key == "Content-Type" })?.value == "application/json")
    }
}

private final class TestOAuthHTTPTransport: OAuthHTTPTransport, @unchecked Sendable {
    private let handler: @Sendable (URLRequest) throws -> (Data, HTTPURLResponse)

    init(handler: @escaping @Sendable (URLRequest) throws -> (Data, HTTPURLResponse)) {
        self.handler = handler
    }

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        try handler(request)
    }
}

private final class MockCoreBridge: CoreBridgeProtocol, @unchecked Sendable {
    let dataDirectoryURL: URL = FileManager.default.temporaryDirectory
    private let lock = NSLock()
    private var scripts: [ScriptRecord] = []
    private var _storedSecrets: [String: String] = [:]
    private(set) var lastPreparedRequest: SavedRequest?
    private(set) var lastSavedRequest: SavedRequest?
    private(set) var saveRequestCallCount: Int = 0
    private(set) var lastRecordedHistory: RequestHistoryEntry?
    var shouldThrowOnStoreSecret: Bool = false
    var workspaceOverride: WorkspaceSummary?
    var environmentSecretsOverride: [String: String] = [:]
    var responseHeadersOverride: [HeaderEntry] = []

    var storedSecrets: [String: String] {
        lock.withLock { _storedSecrets }
    }

    func initializePersistence() async throws -> FfiPersistenceStatus {
        FfiPersistenceStatus(databasePath: "/tmp/kobeanrest.sqlite", migrated: false)
    }
    func appContract() async -> FfiAppContract {
        FfiAppContract(launchModel: "local-first", accountSystem: "none", offlineReady: true, updateChecks: "disabled")
    }
    func localStorageStatus() async -> FfiLocalStorageStatus {
        FfiLocalStorageStatus(database: "SQLite", secretStorage: "Keychain", exportPolicy: "redacted")
    }
    func requestAuthModes() async -> [String] { ["none", "basic", "bearer", "apikey", "oauth2"] }
    func loadWorkspace() async throws -> WorkspaceSummary {
        if let workspaceOverride {
            return workspaceOverride
        }
        return WorkspaceSummary(
            id: "ws-mock",
            name: "Mock Workspace",
            requests: [SavedRequest(id: "req-1", name: "Ping", method: "GET", url: "https://example.com/ping")]
        )
    }
    func listWorkspaces() async throws -> [WorkspaceListItem] {
        [WorkspaceListItem(id: "ws-mock", name: "Mock Workspace")]
    }
    func loadWorkspace(id: String) async throws -> WorkspaceSummary { try await loadWorkspace() }
    func switchWorkspace(id: String) async throws -> WorkspaceSummary { try await loadWorkspace() }
    func createWorkspace(name: String) async throws -> String { "ws-new" }
    func renameWorkspace(id: String, name: String) async throws {}
    func deleteWorkspace(id: String) async throws {}
    func createCollection(name: String, workspaceId: String?) async throws -> String { "col-1" }
    func updateCollection(id: String, name: String) async throws {}
    func deleteCollection(id: String) async throws {}
    func saveCollectionAuth(id: String, authMode: String, authConfig: AuthConfig) async throws {}
    func createFolder(name: String, collectionId: String?, parentId: String?) async throws -> FolderSummary {
        FolderSummary(id: "folder-1", name: name, collectionId: collectionId, parentId: parentId)
    }
    func updateFolder(id: String, name: String) async throws {}
    func deleteFolder(id: String) async throws {}
    func saveFolderAuth(id: String, authMode: String, authConfig: AuthConfig) async throws {}
    func createRequest(folderId: String) async throws -> SavedRequest { SavedRequest.draft(folderID: folderId) }
    func saveRequest(_ request: SavedRequest) async throws {
        lock.withLock {
            lastSavedRequest = request
            saveRequestCallCount += 1
        }
    }
    func deleteRequest(id: String) async throws {}
    func createEnvironment(name: String) async throws -> EnvironmentSummary { EnvironmentSummary(name: name) }
    func renameEnvironment(oldName: String, newName: String) async throws {}
    func deleteEnvironment(name: String) async throws {}
    func setActiveEnvironment(name: String) async throws {}
    func saveVariable(environmentName: String, key: String, value: String, masked: Bool?) async throws {}
    func saveSecretVariable(environmentName: String, key: String, value: String, scope: String) async throws -> String {
        "kobeanrest://secrets/\(scope)/\(key)"
    }
    func deleteVariable(environmentName: String, key: String, secretRef: String?) async throws {}
    func storeSecret(scope: String, key: String, value: String) async throws -> String {
        if shouldThrowOnStoreSecret {
            throw CoreBridgeError.ffi("Simulated Keychain failure")
        }
        let refId = "kobeanrest://secrets/\(scope)/\(key)"
        lock.withLock {
            _storedSecrets[refId] = value
        }
        return refId
    }
    func resolveSecrets(refIds: [String]) async throws -> [String: String] {
        lock.withLock {
            var out: [String: String] = [:]
            for ref in refIds {
                if let val = _storedSecrets[ref] {
                    out[ref] = val
                }
            }
            return out
        }
    }
    func deleteSecret(refId: String) async throws {
        lock.withLock {
            _ = _storedSecrets.removeValue(forKey: refId)
        }
    }
    func resolveEnvironmentSecretValues(workspace: WorkspaceSummary) async -> [String: String] {
        environmentSecretsOverride
    }
    func buildScopedVariableMap(request: SavedRequest, workspace: WorkspaceSummary) async throws -> [String: String] { [:] }
    func getScripts(entityId: String, entityType: String) async throws -> [ScriptRecord] {
        lock.withLock {
            scripts.filter { $0.entityId == entityId && $0.entityType == entityType }
        }
    }
    func getAllScripts() async throws -> [ScriptRecord] {
        lock.withLock { scripts }
    }
    func saveScript(entityId: String, entityType: String, scriptType: String, content: String) async throws {
        lock.withLock {
            if let idx = scripts.firstIndex(where: {
                $0.entityId == entityId && $0.entityType == entityType && $0.scriptType == scriptType
            }) {
                scripts[idx].content = content
            } else {
                scripts.append(ScriptRecord(
                    id: "script-\(UUID().uuidString)",
                    entityId: entityId,
                    entityType: entityType,
                    scriptType: scriptType,
                    content: content,
                    position: 0
                ))
            }
        }
    }
    func deleteScript(scriptId: String) async throws {
        lock.withLock {
            scripts.removeAll { $0.id == scriptId }
        }
    }
    func prepareAndExecuteRequest(
        request: SavedRequest,
        workspace: WorkspaceSummary,
        variableOverrides: [String: String],
        customMethod: String?
    ) async throws -> PreparedExecutionResult {
        lock.withLock {
            lastPreparedRequest = request
        }
        return PreparedExecutionResult(
            prepared: PreparedHttpRequest(method: request.method, url: request.url),
            response: ExecuteHttpResponse(
                status: 200,
                statusText: "OK",
                headers: responseHeadersOverride
            )
        )
    }
    func loadRequestHistory() async throws -> [HistoryEntry] { [] }
    func loadHistoryResponse(id: Int64) async throws -> HistoryResponsePayload { HistoryResponsePayload() }
    func recordRequestHistory(_ entry: RequestHistoryEntry) async throws {
        lock.withLock {
            lastRecordedHistory = entry
        }
    }
    func clearRequestHistory() async throws {}
    func redactUrlForHistory(_ url: String, authMode: String, authConfig: AuthConfig) async throws -> String {
        CoreBridge.sanitizeHistoryURL(url, authMode: authMode, authConfig: authConfig)
    }
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
}
