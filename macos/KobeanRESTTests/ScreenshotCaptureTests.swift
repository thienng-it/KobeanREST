import AppKit
import Darwin
import Foundation
import SwiftUI
import XCTest
@testable import KobeanREST

@MainActor
final class ScreenshotCaptureTests: XCTestCase {
    func testCaptureMacOSScreenshots() async throws {
        guard let outputDirPath = ProcessInfo.processInfo.environment["KOBEAN_CAPTURE_SCREENSHOTS_DIR"],
              !outputDirPath.isEmpty else {
            throw XCTSkip("Set KOBEAN_CAPTURE_SCREENSHOTS_DIR to capture macOS app screenshots.")
        }

        let outputDir = URL(fileURLWithPath: outputDirPath, isDirectory: true)
        try FileManager.default.createDirectory(at: outputDir, withIntermediateDirectories: true)

        let tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("kobeanrest-workspace-\(UUID().uuidString.prefix(8))", isDirectory: true)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let bridge = CoreBridge(dataDirectoryURL: tempDir)
        let appState = AppState(bridge: bridge)
        await appState.bootstrap()

        // Remove auto-seeded starter collection so showcase collections stay crisp
        for existingCol in appState.workspace?.collections ?? [] {
            try? await bridge.deleteCollection(id: existingCol.id)
        }
        appState.settings = AppSettings(
            theme: "light",
            exportRedactionEnabled: true,
            diagnosticsRedactionEnabled: true,
            responseAutoWrap: true
        )

        let port = Self.freeEphemeralPort()
        let baseURL = "http://127.0.0.1:\(port)"

        // Seed rich, clean showcase collections, folders, requests, scripts, and history
        let coreColId = try await bridge.createCollection(name: "KobeanREST API", workspaceId: nil)
        let billingColId = try await bridge.createCollection(name: "Billing & Orders", workspaceId: nil)

        let usersFolder = try await bridge.createFolder(name: "Users & Auth", collectionId: coreColId, parentId: nil)
        let platformFolder = try await bridge.createFolder(name: "GraphQL & Health", collectionId: coreColId, parentId: nil)
        let ordersFolder = try await bridge.createFolder(name: "Orders Service", collectionId: billingColId, parentId: nil)
        let streamFolder = try await bridge.createFolder(name: "Realtime Events", collectionId: billingColId, parentId: nil)

        var getUserReq = SavedRequest(
            id: "showcase-get-user",
            name: "Fetch User Profile",
            method: "GET",
            url: "\(baseURL)/v1/users/:userId?include=roles,teams&limit=25",
            folderId: usersFolder.id,
            authMode: "bearer",
            authConfig: AuthConfig(token: "{{apiToken}}").encodeJson(),
            headers: [
                HeaderEntry(key: "Accept", value: "application/json", enabled: true),
                HeaderEntry(key: "X-Client-Platform", value: "macOS-SwiftUI", enabled: true),
            ],
            queryParams: Self.encodeJSON([
                HeaderEntry(key: "include", value: "roles,teams", enabled: true),
                HeaderEntry(key: "limit", value: "25", enabled: true),
            ]),
            pathVariables: [PathVariableEntry(key: "userId", value: "usr_42")]
        )

        let oauthRunReq = SavedRequest(
            id: "showcase-oauth",
            name: "OAuth 2.0 Token Exchange",
            method: "POST",
            url: "\(baseURL)/oauth/token",
            folderId: usersFolder.id,
            authMode: "oauth2",
            authConfig: AuthConfig(
                grantType: "authorization_code",
                authUrl: "https://auth.kobeanrest.dev/authorize",
                accessTokenUrl: "https://auth.kobeanrest.dev/oauth/token",
                clientId: "kobeanrest-macos-cli",
                scope: "read:workspace write:collections offline_access",
                redirectUri: "kobeanrest://oauth/callback"
            ).encodeJson(),
            headers: [
                HeaderEntry(key: "Content-Type", value: "application/json", enabled: true),
            ]
        )

        let createOrderReq = SavedRequest(
            id: "showcase-create-order",
            name: "Create Order",
            method: "POST",
            url: "\(baseURL)/v1/orders",
            folderId: ordersFolder.id,
            authMode: "bearer",
            authConfig: AuthConfig(token: "{{apiToken}}").encodeJson(),
            headers: [
                HeaderEntry(key: "Content-Type", value: "application/json", enabled: true),
                HeaderEntry(key: "Idempotency-Key", value: "ord_2026_9821", enabled: true),
            ],
            body: """
            {
              "customerId": "cus_kobean_019",
              "currency": "USD",
              "items": [
                { "sku": "PRO-WORKBENCH", "quantity": 1, "unitPrice": 0 },
                { "sku": "LOCAL-SYNC-PACK", "quantity": 2, "unitPrice": 0 }
              ],
              "metadata": {
                "source": "macos-native",
                "localFirst": true
              }
            }
            """,
            bodyMimeType: "application/json"
        )

        let graphqlReq = SavedRequest(
            id: "showcase-graphql",
            name: "Workspace Schema Query",
            method: "POST",
            url: "\(baseURL)/graphql",
            folderId: platformFolder.id,
            headers: [
                HeaderEntry(key: "Content-Type", value: "application/json", enabled: true),
            ],
            body: """
            query GetWorkspaceSummary($workspaceId: ID!) {
              workspace(id: $workspaceId) {
                id
                name
                activeEnvironment
                collections {
                  id
                  name
                  requestCount
                }
              }
            }
            """,
            bodyMimeType: "application/graphql"
        )

        let healthReq = SavedRequest(
            id: "showcase-health",
            name: "Gateway Health & SLA",
            method: "GET",
            url: "\(baseURL)/v1/health",
            folderId: platformFolder.id,
            headers: [
                HeaderEntry(key: "Accept", value: "application/json", enabled: true),
            ]
        )

        let wsReq = SavedRequest(
            id: "showcase-ws",
            name: "Realtime Order Stream",
            method: "WS",
            url: "wss://stream.kobeanrest.dev/v1/events",
            folderId: streamFolder.id,
            headers: [
                HeaderEntry(key: "X-Stream-Channel", value: "orders.v1", enabled: true),
            ]
        )

        for req in [getUserReq, oauthRunReq, createOrderReq, graphqlReq, healthReq, wsReq] {
            try await bridge.saveRequest(req)
        }

        // Save pre/post scripts for Health & SLA
        let preScript = """
        // Inject dynamic correlation headers before dispatching
        kb.request.setHeader("X-Trace-Id", "tr_91a4e0c2");
        console.log("Dispatching", kb.request.method, kb.request.url);
        """
        let postScript = """
        kb.test("Status code is 200 OK", () => {
          kb.expect(kb.response.status).toBe(200);
        });
        kb.test("Response contains healthy status", () => {
          const json = kb.response.json();
          kb.expect(json.status).toBe("healthy");
        });
        kb.test("Latency within 250ms SLA", () => {
          kb.expect(kb.response.durationMs).toBeLessThan(250);
        });
        console.log("Verified gateway health payload");
        """
        try await bridge.saveScript(entityId: healthReq.id, entityType: "request", scriptType: "pre", content: preScript)
        try await bridge.saveScript(entityId: healthReq.id, entityType: "request", scriptType: "post", content: postScript)

        // Start loopback Rust mock server via MockServerViewModel with realistic JSON routes
        let mockServer = FfiMockServer()
        let mockRoutes: [MockRouteItem] = [
            MockRouteItem(
                id: "route-user",
                method: "GET",
                path: "/v1/users/usr_42",
                statusCode: 200,
                responseBody: """
                {
                  "id": "usr_42",
                  "name": "Alice Nguyen",
                  "email": "alice@example.com",
                  "role": "staff_engineer",
                  "teams": ["core-runtime", "macos-native"],
                  "workspace": {
                    "storage": "sqlite-wal",
                    "keychain": "enabled",
                    "localOnly": true
                  }
                }
                """,
                contentType: "application/json",
                delayMs: 12,
                enabled: true
            ),
            MockRouteItem(
                id: "route-oauth",
                method: "POST",
                path: "/oauth/token",
                statusCode: 200,
                responseBody: #"{"token_type":"Bearer","expires_in":3600,"scope":"read:workspace"}"#,
                contentType: "application/json",
                delayMs: 10,
                enabled: true
            ),
            MockRouteItem(
                id: "route-orders",
                method: "POST",
                path: "/v1/orders",
                statusCode: 201,
                responseBody: """
                {
                  "orderId": "ord_98214",
                  "status": "confirmed",
                  "currency": "USD",
                  "createdAt": "2026-11-15T14:30:00Z",
                  "receipt": {
                    "channel": "native-macos",
                    "verified": true
                  }
                }
                """,
                contentType: "application/json",
                delayMs: 18,
                enabled: true
            ),
            MockRouteItem(
                id: "route-graphql",
                method: "POST",
                path: "/graphql",
                statusCode: 200,
                responseBody: """
                {
                  "data": {
                    "workspace": {
                      "id": "ws_local_primary",
                      "name": "Local Workspace",
                      "activeEnvironment": "Production",
                      "collections": [
                        { "id": "col_1", "name": "KobeanREST API", "requestCount": 14 },
                        { "id": "col_2", "name": "Billing & Orders", "requestCount": 8 }
                      ]
                    }
                  }
                }
                """,
                contentType: "application/json",
                delayMs: 15,
                enabled: true
            ),
            MockRouteItem(
                id: "route-health",
                method: "GET",
                path: "/v1/health",
                statusCode: 200,
                responseBody: """
                {
                  "status": "healthy",
                  "engine": "kobean-core-0.2.0",
                  "uptimeSeconds": 84210,
                  "subsystems": {
                    "sqlite": "ok",
                    "keychain": "ok",
                    "mockServer": "running"
                  }
                }
                """,
                contentType: "application/json",
                delayMs: 8,
                enabled: true
            ),
        ]
        let mockVM = MockServerViewModel(server: mockServer)
        mockVM.portText = String(port)
        mockVM.routes = mockRoutes
        mockVM.selectedRouteID = mockRoutes[0].id
        await mockVM.startServer(activeCollectionId: coreColId)
        defer { try? mockServer.stop() }

        // Hit mock server routes once so MockServerSheetView shows real request logs
        for (method, path) in [("GET", "/v1/users/usr_42?include=roles,teams&limit=25"), ("POST", "/v1/orders"), ("GET", "/v1/health")] {
            var urlReq = URLRequest(url: URL(string: "\(baseURL)\(path)")!)
            urlReq.httpMethod = method
            _ = try? await URLSession.shared.data(for: urlReq)
        }
        await mockVM.refreshAll()
        mockVM.selectedRouteID = mockRoutes[0].id

        // Refresh workspace and inject showcase environments (non-Keychain display preview)
        await appState.refreshWorkspace()
        var showcaseWorkspace = appState.workspace
        let demoEnvs: [EnvironmentSummary] = [
            EnvironmentSummary(name: "Production", variables: [
                EnvironmentVariable(key: "baseUrl", value: "https://api.kobeanrest.dev", secret: false, masked: false),
                EnvironmentVariable(key: "workspaceId", value: "ws_local_primary", secret: false, masked: false),
                EnvironmentVariable(key: "apiToken", value: "", secret: true, secretRef: "kobeanrest://secrets/prod-api-token", masked: true),
                EnvironmentVariable(key: "oauthClientSecret", value: "", secret: true, secretRef: "kobeanrest://secrets/oauth-client", masked: true),
            ]),
            EnvironmentSummary(name: "Staging", variables: [
                EnvironmentVariable(key: "baseUrl", value: "https://staging-api.kobeanrest.dev", secret: false, masked: false),
                EnvironmentVariable(key: "apiToken", value: "stg_demo_example_value", secret: false, masked: true),
            ]),
            EnvironmentSummary(name: "Local Mock", variables: [
                EnvironmentVariable(key: "baseUrl", value: baseURL, secret: false, masked: false),
                EnvironmentVariable(key: "apiToken", value: "local-mock-token", secret: false, masked: false),
            ]),
        ]
        showcaseWorkspace?.environments = demoEnvs
        showcaseWorkspace?.activeEnvironment = "Production"
        appState.workspace = showcaseWorkspace

        // Populate History entries
        let historySamples: [[String: Any]] = [
            ["id": 1, "requestId": getUserReq.id, "method": "GET", "url": "https://api.kobeanrest.dev/v1/users/usr_42?include=roles,teams&limit=25", "status": 200, "durationMs": 14, "sizeBytes": 248, "createdAt": "2026-11-15T14:32:10Z"],
            ["id": 2, "requestId": createOrderReq.id, "method": "POST", "url": "https://api.kobeanrest.dev/v1/orders", "status": 201, "durationMs": 21, "sizeBytes": 194, "createdAt": "2026-11-15T14:31:52Z"],
            ["id": 3, "requestId": graphqlReq.id, "method": "POST", "url": "https://api.kobeanrest.dev/graphql", "status": 200, "durationMs": 17, "sizeBytes": 312, "createdAt": "2026-11-15T14:31:20Z"],
            ["id": 4, "requestId": healthReq.id, "method": "GET", "url": "https://api.kobeanrest.dev/v1/health", "status": 200, "durationMs": 9, "sizeBytes": 186, "createdAt": "2026-11-15T14:30:48Z"],
            ["id": 5, "requestId": oauthRunReq.id, "method": "POST", "url": "https://auth.kobeanrest.dev/oauth/token?access_token=[REDACTED]", "status": 200, "durationMs": 42, "sizeBytes": 410, "createdAt": "2026-11-15T14:29:15Z"],
        ]
        let historyData = try JSONSerialization.data(withJSONObject: historySamples)
        appState.history = try JSONDecoder().decode([HistoryEntry].self, from: historyData)

        let routeBody: (String) -> String = { id in
            mockRoutes.first(where: { $0.id == id })?.responseBody ?? "{}"
        }

        // Set up multiple realistic open tabs
        let userBody = routeBody("route-user")
        let userResponse = ExecuteHttpResponse(
            status: 200,
            statusText: "OK",
            headers: [
                HeaderEntry(key: "Content-Type", value: "application/json; charset=utf-8", enabled: true),
                HeaderEntry(key: "Cache-Control", value: "private, max-age=60", enabled: true),
                HeaderEntry(key: "X-RateLimit-Remaining", value: "4998", enabled: true),
                HeaderEntry(key: "X-Request-Id", value: "req_01JCP8W9K", enabled: true),
            ],
            bodyText: userBody,
            durationMs: 24,
            dnsMs: 2,
            connectMs: 4,
            tlsMs: 7,
            requestMs: 11,
            sizeBytes: userBody.utf8.count,
            contentType: "application/json"
        )

        let orderBody = routeBody("route-orders")
        let orderResponse = ExecuteHttpResponse(
            status: 201,
            statusText: "Created",
            headers: [
                HeaderEntry(key: "Content-Type", value: "application/json", enabled: true),
                HeaderEntry(key: "Location", value: "/v1/orders/ord_98214", enabled: true),
            ],
            bodyText: orderBody,
            durationMs: 31,
            dnsMs: 2,
            connectMs: 5,
            tlsMs: 8,
            requestMs: 16,
            sizeBytes: orderBody.utf8.count,
            contentType: "application/json"
        )

        let gqlBody = routeBody("route-graphql")
        let gqlResponse = ExecuteHttpResponse(
            status: 200,
            statusText: "OK",
            headers: [
                HeaderEntry(key: "Content-Type", value: "application/json", enabled: true),
            ],
            bodyText: gqlBody,
            durationMs: 19,
            dnsMs: 1,
            connectMs: 3,
            tlsMs: 5,
            requestMs: 10,
            sizeBytes: gqlBody.utf8.count,
            contentType: "application/json"
        )

        let healthBody = routeBody("route-health")
        let healthResponse = ExecuteHttpResponse(
            status: 200,
            statusText: "OK",
            headers: [
                HeaderEntry(key: "Content-Type", value: "application/json", enabled: true),
            ],
            bodyText: healthBody,
            durationMs: 12,
            dnsMs: 1,
            connectMs: 2,
            tlsMs: 3,
            requestMs: 6,
            sizeBytes: healthBody.utf8.count,
            contentType: "application/json"
        )

        // Friendly HTTPS display URL for screenshots (responses already populated)
        getUserReq.url = "https://api.kobeanrest.dev/v1/users/:userId?include=roles,teams&limit=25"
        var orderDisplayReq = createOrderReq
        orderDisplayReq.url = "https://api.kobeanrest.dev/v1/orders"
        var gqlDisplayReq = graphqlReq
        gqlDisplayReq.url = "https://api.kobeanrest.dev/graphql"
        var healthDisplayReq = healthReq
        healthDisplayReq.url = "https://api.kobeanrest.dev/v1/health"

        let userTab = RequestTab(
            request: getUserReq,
            isDirty: false,
            isPersisted: true,
            responseState: .success(userResponse),
            inspectorTab: .params,
            responseInspectorTab: .body
        )
        let orderTab = RequestTab(
            request: orderDisplayReq,
            isDirty: false,
            isPersisted: true,
            responseState: .success(orderResponse),
            inspectorTab: .body,
            responseInspectorTab: .body
        )
        let gqlTab = RequestTab(
            request: gqlDisplayReq,
            isDirty: false,
            isPersisted: true,
            responseState: .success(gqlResponse),
            inspectorTab: .body,
            responseInspectorTab: .body
        )
        let healthTab = RequestTab(
            request: healthDisplayReq,
            isDirty: false,
            isPersisted: true,
            responseState: .success(healthResponse),
            inspectorTab: .scripts,
            responseInspectorTab: .tests,
            preScript: preScript,
            postScript: postScript,
            testResults: [
                ScriptTestResult(name: "Status code is 200 OK", passed: true),
                ScriptTestResult(name: "Response contains healthy status", passed: true),
                ScriptTestResult(name: "Latency within 250ms SLA", passed: true),
            ],
            scriptLogs: [
                ScriptLogEntry(level: .log, message: "Dispatching GET https://api.kobeanrest.dev/v1/health"),
                ScriptLogEntry(level: .log, message: "Verified gateway health payload"),
            ]
        )
        var oauthDisplayReq = oauthRunReq
        oauthDisplayReq.url = "https://auth.kobeanrest.dev/oauth/token"

        let oauthTab = RequestTab(
            request: oauthDisplayReq,
            isDirty: false,
            isPersisted: true,
            responseState: .idle,
            inspectorTab: .auth,
            responseInspectorTab: .body
        )

        appState.tabs = [userTab, orderTab, gqlTab, healthTab, oauthTab]
        appState.selectedTabID = userTab.id
        appState.settings.theme = "light"
        appState.splitOrientation = .horizontal
        appState.sidebarSection = .collections

        let windowSize = NSSize(width: 1360, height: 840)

        // 1. Main REST Workbench (Light)
        try await captureMainWindow(
            RootWorkbenchView(appState: appState),
            size: windowSize,
            darkMode: false,
            to: outputDir.appendingPathComponent("workbench-rest.png")
        )

        // 2. Query Params & Path Variables + Response Headers
        appState.updateTab(id: userTab.id) {
            $0.inspectorTab = .params
            $0.responseInspectorTab = .headers
        }
        try await captureMainWindow(
            RootWorkbenchView(appState: appState),
            size: windowSize,
            darkMode: false,
            to: outputDir.appendingPathComponent("params-sync.png")
        )

        // 3. History Viewer & Timing Waterfall
        appState.sidebarSection = .history
        appState.updateTab(id: userTab.id) {
            $0.inspectorTab = .headers
            $0.responseInspectorTab = .timing
        }
        try await captureMainWindow(
            RootWorkbenchView(appState: appState),
            size: windowSize,
            darkMode: false,
            to: outputDir.appendingPathComponent("history-timing.png")
        )
        appState.sidebarSection = .collections

        // 4. Native macOS Dark Mode (POST JSON Body + 201 Created Response)
        appState.selectedTabID = orderTab.id
        appState.settings.theme = "dark"
        try await captureMainWindow(
            RootWorkbenchView(appState: appState),
            size: windowSize,
            darkMode: true,
            to: outputDir.appendingPathComponent("workbench-dark.png")
        )
        appState.settings.theme = "light"

        // 5. GraphQL Studio
        appState.selectedTabID = gqlTab.id
        try await captureMainWindow(
            RootWorkbenchView(appState: appState),
            size: windowSize,
            darkMode: false,
            to: outputDir.appendingPathComponent("graphql-studio.png")
        )

        // 6. Pre/Post Scripts & Tests
        appState.selectedTabID = healthTab.id
        try await captureMainWindow(
            RootWorkbenchView(appState: appState),
            size: windowSize,
            darkMode: false,
            to: outputDir.appendingPathComponent("scripts-tests.png")
        )

        // 7. OAuth 2.0 + PKCE Auth Inspector
        appState.selectedTabID = oauthTab.id
        try await captureMainWindow(
            RootWorkbenchView(appState: appState),
            size: windowSize,
            darkMode: false,
            to: outputDir.appendingPathComponent("auth-oauth2.png")
        )

        // Reset active tab back to main GET user tab for sheet backdrops & WebSocket
        appState.selectedTabID = userTab.id
        appState.updateTab(id: userTab.id) {
            $0.inspectorTab = .params
            $0.responseInspectorTab = .body
        }
        let backdropRep = try await snapshotMainWindow(
            RootWorkbenchView(appState: appState),
            size: windowSize,
            darkMode: false
        )

        // 8. WebSocket Workbench
        let wsVM = WebSocketViewModel(url: wsReq.url, headers: wsReq.headers)
        wsVM.connectionState = .connected(url: wsReq.url)
        wsVM.messages = [
            WebSocketMessage(direction: .system, payload: .text("Connected to wss://stream.kobeanrest.dev/v1/events")),
            WebSocketMessage(direction: .outgoing, payload: .text(#"{"type":"subscribe","channel":"orders.v1","filters":{"region":"us-west"}}"#)),
            WebSocketMessage(direction: .incoming, payload: .text(#"{"type":"subscribed","channel":"orders.v1","seq":1042}"#)),
            WebSocketMessage(direction: .incoming, payload: .text(#"{"event":"order.confirmed","orderId":"ord_98214","amountCents":4900}"#)),
            WebSocketMessage(direction: .outgoing, payload: .text(#"{"type":"ack","seq":1042}"#)),
        ]
        wsVM.draftMessage = #"{"type":"ping","clientTime":"2026-11-15T14:32:10Z"}"#
        let wsShell = NavigationSplitView {
            SidebarView(appState: appState)
                .navigationSplitViewColumnWidth(min: 220, ideal: 260, max: 340)
        } detail: {
            VStack(spacing: 0) {
                HStack(spacing: 10) {
                    Text("WS")
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundStyle(.purple)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.purple.opacity(0.12), in: RoundedRectangle(cornerRadius: 6))
                    Text(wsReq.url)
                        .font(.system(size: 12.5, design: .monospaced))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 6))
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.primary.opacity(0.12), lineWidth: 1))
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                Divider()
                WebSocketWorkbenchView(url: wsReq.url, headers: wsReq.headers, initialViewModel: wsVM)
            }
        }
        try await captureMainWindow(
            wsShell,
            size: windowSize,
            darkMode: false,
            to: outputDir.appendingPathComponent("websocket-stream.png")
        )

        // 9. Local Mock Server Sheet (backed by live loopback Rust mock server)
        try await captureSheetOverBackdrop(
            MockServerSheetView(
                collections: showcaseWorkspace?.collections ?? [],
                folders: showcaseWorkspace?.folders ?? [],
                requests: showcaseWorkspace?.requests ?? [],
                initialViewModel: mockVM
            ),
            backdrop: backdropRep,
            darkMode: false,
            to: outputDir.appendingPathComponent("mock-server.png"),
            settleSeconds: 0.9
        )

        // 10. Collection Runner Sheet (execute live run against local loopback mock server!)
        let runnerVM = CollectionRunnerViewModel(bridge: bridge, workspace: appState.workspace!)
        runnerVM.selectedCollectionID = coreColId
        runnerVM.startRun()
        let deadline = Date().addingTimeInterval(6.0)
        while runnerVM.isRunning && Date() < deadline {
            try await Task.sleep(for: .milliseconds(50))
        }
        try await captureSheetOverBackdrop(
            CollectionRunnerSheetView(bridge: bridge, workspace: appState.workspace!, initialViewModel: runnerVM),
            backdrop: backdropRep,
            darkMode: false,
            to: outputDir.appendingPathComponent("collection-runner.png")
        )

        // 11. Environment & Keychain Secrets Manager Sheet
        try await captureSheetOverBackdrop(
            EnvironmentManagerView(appState: appState),
            backdrop: backdropRep,
            darkMode: false,
            to: outputDir.appendingPathComponent("environment-manager.png")
        )

        // 12. Universal Importer Sheet (auto-detects OpenAPI 3.0 YAML)
        let sampleOpenAPI = """
        openapi: 3.0.3
        info:
          title: KobeanREST Demo API
          version: 1.0.0
        servers:
          - url: https://api.kobeanrest.dev/v1
        paths:
          /users/{userId}:
            get:
              summary: Fetch User Profile
              responses:
                '200':
                  description: OK
          /orders:
            post:
              summary: Create Order
              responses:
                '201':
                  description: Created
        """
        try await captureSheetOverBackdrop(
            ImportSheetView(appState: appState, initialContent: sampleOpenAPI),
            backdrop: backdropRep,
            darkMode: false,
            to: outputDir.appendingPathComponent("universal-importer.png"),
            settleSeconds: 0.9
        )

        // 13. Code Snippet Generator Sheet
        var snippetReq = getUserReq
        snippetReq.url = "https://api.kobeanrest.dev/v1/users/:userId"
        snippetReq.headers.append(HeaderEntry(key: "Authorization", value: "Bearer demo_showcase_token_placeholder", enabled: true))
        try await captureSheetOverBackdrop(
            SnippetSheetView(request: snippetReq, customMethod: nil),
            backdrop: backdropRep,
            darkMode: false,
            to: outputDir.appendingPathComponent("code-snippets.png")
        )

        // 14. MCP Tools Inspector Sheet
        try await captureSheetOverBackdrop(
            McpToolsSheetView(dataDirectoryURL: tempDir),
            backdrop: backdropRep,
            darkMode: false,
            to: outputDir.appendingPathComponent("mcp-tools.png"),
            settleSeconds: 0.9
        )

        // 15. Native Settings Window
        try await captureMainWindow(
            SettingsView(appState: appState),
            size: NSSize(width: 540, height: 470),
            darkMode: false,
            title: "KobeanREST Settings",
            styleMask: [.titled, .closable],
            toolbarStyle: .automatic,
            to: outputDir.appendingPathComponent("settings.png"),
            settleSeconds: 0.9
        )
    }

    // MARK: - Window & Sheet Snapshot Helpers

    private func captureMainWindow<V: View>(
        _ view: V,
        size: NSSize,
        darkMode: Bool,
        title: String = "KobeanREST",
        styleMask: NSWindow.StyleMask = [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
        toolbarStyle: NSWindow.ToolbarStyle = .unified,
        to url: URL,
        settleSeconds: TimeInterval = 0.75
    ) async throws {
        let rep = try await snapshotMainWindow(
            view,
            size: size,
            darkMode: darkMode,
            title: title,
            styleMask: styleMask,
            toolbarStyle: toolbarStyle,
            settleSeconds: settleSeconds
        )
        try writePNG(rep, to: url)
    }

    private func snapshotMainWindow<V: View>(
        _ view: V,
        size: NSSize,
        darkMode: Bool,
        title: String = "KobeanREST",
        styleMask: NSWindow.StyleMask = [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
        toolbarStyle: NSWindow.ToolbarStyle = .unified,
        settleSeconds: TimeInterval = 0.75
    ) async throws -> NSBitmapImageRep {
        let appearanceName: NSAppearance.Name = darkMode ? .darkAqua : .aqua
        let window = NSWindow(
            contentRect: NSRect(origin: NSPoint(x: 80, y: 80), size: size),
            styleMask: styleMask,
            backing: .buffered,
            defer: false
        )
        window.title = title
        window.toolbarStyle = toolbarStyle
        window.appearance = NSAppearance(named: appearanceName)
        window.isReleasedWhenClosed = false
        window.contentView = NSHostingView(rootView: view.preferredColorScheme(darkMode ? .dark : .light))

        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
        window.makeKeyAndOrderFront(nil)

        try await Task.sleep(for: .milliseconds(Int(settleSeconds * 1000)))
        defer { window.close() }

        guard let frameView = window.contentView?.superview else {
            throw NSError(domain: "ScreenshotCapture", code: 1, userInfo: [NSLocalizedDescriptionKey: "Missing NSThemeFrame"])
        }

        Self.prepareLiquidGlassForOffscreenSnapshot(in: frameView, darkMode: darkMode)
        frameView.layoutSubtreeIfNeeded()
        try await Task.sleep(for: .milliseconds(120))

        let bounds = frameView.bounds
        guard let rep = Self.makeRetinaRep(size: bounds.size),
              let ctx = NSGraphicsContext(bitmapImageRep: rep) else {
            throw NSError(domain: "ScreenshotCapture", code: 2, userInfo: [NSLocalizedDescriptionKey: "Unable to allocate NSBitmapImageRep"])
        }

        let fillColor: NSColor = darkMode
            ? NSColor(calibratedRed: 0.12, green: 0.12, blue: 0.13, alpha: 1.0)
            : NSColor.windowBackgroundColor

        if let rawCache = frameView.bitmapImageRepForCachingDisplay(in: bounds) {
            frameView.cacheDisplay(in: bounds, to: rawCache)
            NSGraphicsContext.saveGraphicsState()
            NSGraphicsContext.current = ctx
            let clip = NSBezierPath(roundedRect: bounds, xRadius: 12, yRadius: 12)
            clip.addClip()
            fillColor.setFill()
            bounds.fill()
            rawCache.draw(in: bounds)
            NSBezierPath(roundedRect: bounds.insetBy(dx: 0.5, dy: 0.5), xRadius: 12, yRadius: 12)
                .strokeColor(NSColor.labelColor.withAlphaComponent(darkMode ? 0.22 : 0.12))
            NSGraphicsContext.restoreGraphicsState()
        }
        return rep
    }

    private func captureSheetOverBackdrop<SheetView: View>(
        _ sheetView: SheetView,
        backdrop: NSBitmapImageRep,
        darkMode: Bool,
        to url: URL,
        settleSeconds: TimeInterval = 0.6
    ) async throws {
        let appearanceName: NSAppearance.Name = darkMode ? .darkAqua : .aqua
        let host = NSHostingView(rootView: sheetView.preferredColorScheme(darkMode ? .dark : .light))
        host.appearance = NSAppearance(named: appearanceName)
        let fittingSize = host.fittingSize
        let sheetWindow = NSWindow(
            contentRect: NSRect(origin: NSPoint(x: 120, y: 120), size: fittingSize),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        sheetWindow.appearance = NSAppearance(named: appearanceName)
        sheetWindow.isOpaque = false
        sheetWindow.backgroundColor = .clear
        sheetWindow.isReleasedWhenClosed = false
        sheetWindow.contentView = host
        sheetWindow.makeKeyAndOrderFront(nil)
        try await Task.sleep(for: .milliseconds(Int(settleSeconds * 1000)))
        defer { sheetWindow.close() }

        host.layoutSubtreeIfNeeded()
        let sheetBounds = NSRect(origin: .zero, size: host.bounds.size)
        guard let sheetRep = host.bitmapImageRepForCachingDisplay(in: sheetBounds) else {
            throw NSError(domain: "ScreenshotCapture", code: 3, userInfo: [NSLocalizedDescriptionKey: "Unable to cache sheet view"])
        }
        host.cacheDisplay(in: sheetBounds, to: sheetRep)

        let canvasSize = backdrop.size
        guard let composite = Self.makeRetinaRep(size: canvasSize),
              let ctx = NSGraphicsContext(bitmapImageRep: composite) else {
            throw NSError(domain: "ScreenshotCapture", code: 4, userInfo: [NSLocalizedDescriptionKey: "Unable to create composite rep"])
        }

        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = ctx

        let fullRect = NSRect(origin: .zero, size: canvasSize)
        NSBezierPath(roundedRect: fullRect, xRadius: 12, yRadius: 12).addClip()
        backdrop.draw(in: fullRect)

        // Subtle macOS sheet scrim over parent window
        NSColor.black.withAlphaComponent(0.24).setFill()
        fullRect.fill()

        let sheetOrigin = NSPoint(
            x: ((canvasSize.width - sheetBounds.width) / 2.0).rounded(),
            y: ((canvasSize.height - sheetBounds.height) / 2.0).rounded()
        )
        let targetRect = NSRect(origin: sheetOrigin, size: sheetBounds.size)

        // Shadow & rounded sheet bezel
        NSGraphicsContext.saveGraphicsState()
        let shadow = NSShadow()
        shadow.shadowOffset = NSSize(width: 0, height: -8)
        shadow.shadowBlurRadius = 24
        shadow.shadowColor = NSColor.black.withAlphaComponent(0.32)
        shadow.set()
        let sheetPath = NSBezierPath(roundedRect: targetRect, xRadius: 12, yRadius: 12)
        NSColor.windowBackgroundColor.setFill()
        sheetPath.fill()
        NSGraphicsContext.restoreGraphicsState()

        NSGraphicsContext.saveGraphicsState()
        sheetPath.addClip()
        sheetRep.draw(in: targetRect)
        NSGraphicsContext.restoreGraphicsState()

        sheetPath.strokeColor(NSColor.labelColor.withAlphaComponent(0.16))
        NSGraphicsContext.restoreGraphicsState()

        try writePNG(composite, to: url)
    }

    private func writePNG(_ rep: NSBitmapImageRep, to url: URL) throws {
        guard let pngData = rep.representation(using: .png, properties: [:]) else {
            throw NSError(domain: "ScreenshotCapture", code: 5, userInfo: [NSLocalizedDescriptionKey: "PNG encoding failed"])
        }
        try pngData.write(to: url)
    }

    private static func makeRetinaRep(size: NSSize) -> NSBitmapImageRep? {
        guard let rep = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: max(1, Int((size.width * 2).rounded())),
            pixelsHigh: max(1, Int((size.height * 2).rounded())),
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0
        ) else {
            return nil
        }
        rep.size = size
        return rep
    }

    private static func prepareLiquidGlassForOffscreenSnapshot(in root: NSView, darkMode: Bool) {
        let className = String(describing: type(of: root))
        if className == "BackdropView" || className == "NSVisualEffectView" || className == "NSBlurryAlleywayView" {
            root.isHidden = true
        }
        if className.contains("_NSCoreHostingView"),
           let superName = root.superview.map({ String(describing: type(of: $0)) }),
           superName.contains("Glass") {
            root.isHidden = true
        }
        if className == "NSContainerConcentricGlassEffectView" {
            root.wantsLayer = true
            root.layer?.cornerRadius = 10
            root.layer?.masksToBounds = true
            root.layer?.backgroundColor = (
                darkMode
                    ? NSColor(calibratedRed: 0.165, green: 0.17, blue: 0.185, alpha: 1.0)
                    : NSColor(calibratedRed: 0.955, green: 0.96, blue: 0.97, alpha: 1.0)
            ).cgColor
            root.layer?.borderWidth = 1
            root.layer?.borderColor = NSColor.labelColor.withAlphaComponent(darkMode ? 0.12 : 0.08).cgColor
        }
        for child in root.subviews {
            prepareLiquidGlassForOffscreenSnapshot(in: child, darkMode: darkMode)
        }
    }

    private static func encodeJSON<T: Encodable>(_ value: T) -> String {
        let enc = JSONEncoder()
        enc.outputFormatting = [.sortedKeys]
        guard let data = try? enc.encode(value), let str = String(data: data, encoding: .utf8) else {
            return "[]"
        }
        return str
    }

    private static func freeEphemeralPort() -> UInt16 {
        let sock = Darwin.socket(AF_INET, SOCK_STREAM, 0)
        precondition(sock >= 0)
        defer { Darwin.close(sock) }
        var addr = sockaddr_in()
        addr.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
        addr.sin_family = sa_family_t(AF_INET)
        addr.sin_port = 0
        addr.sin_addr = in_addr(s_addr: inet_addr("127.0.0.1"))
        let bindResult = withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                Darwin.bind(sock, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
            }
        }
        precondition(bindResult == 0)
        var boundAddr = sockaddr_in()
        var len = socklen_t(MemoryLayout<sockaddr_in>.size)
        let nameResult = withUnsafeMutablePointer(to: &boundAddr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                Darwin.getsockname(sock, $0, &len)
            }
        }
        precondition(nameResult == 0)
        return UInt16(bigEndian: boundAddr.sin_port)
    }
}

private extension NSBezierPath {
    func strokeColor(_ color: NSColor, width: CGFloat = 1) {
        color.setStroke()
        lineWidth = width
        stroke()
    }
}
