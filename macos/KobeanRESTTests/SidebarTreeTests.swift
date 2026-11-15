import Foundation
import Testing
@testable import KobeanREST

@Suite("Sidebar Tree & Inline Rename")
@MainActor
struct SidebarTreeTests {
    private func sampleWorkspace() -> WorkspaceSummary {
        WorkspaceSummary(
            id: "ws-1",
            name: "Local Workspace",
            folders: [
                FolderSummary(id: "fol-sys", name: "System", collectionId: "col-1", parentId: nil),
                FolderSummary(id: "fol-users", name: "Users API", collectionId: "col-1", parentId: nil),
                FolderSummary(id: "fol-sub", name: "Auth", collectionId: "col-1", parentId: "fol-users"),
                FolderSummary(id: "fol-orphan", name: "Orphan Folder", collectionId: "missing-col", parentId: nil),
            ],
            requests: [
                SavedRequest(id: "req-col", name: "Root Health", method: "GET", url: "https://api.test/health", folderId: "col-1"),
                SavedRequest(id: "req-sys", name: "Status", method: "GET", url: "https://api.test/status", folderId: "fol-sys"),
                SavedRequest(id: "req-profile", name: "Fetch profile", method: "GET", url: "https://api.test/users/me", folderId: "fol-users"),
                SavedRequest(id: "req-login", name: "Login", method: "POST", url: "https://api.test/auth/login", folderId: "fol-sub"),
                SavedRequest(id: "req-orphan", name: "Orphan Req", method: "GET", url: "https://api.test/orphan", folderId: "fol-orphan"),
                SavedRequest(id: "req-unfiled", name: "Unfiled Ping", method: "PATCH", url: "https://api.test/ping", folderId: "unknown-container"),
            ],
            collections: [
                CollectionSummary(id: "col-1", name: "KobeanREST"),
                CollectionSummary(id: "col-empty", name: "Empty Collection"),
            ]
        )
    }

    @Test("SidebarTreeBuilder flattens collections, nested folders, orphan folders, and unfiled requests with depths")
    func flattensExpandedTreeInOrder() {
        let ws = sampleWorkspace()
        let rows = SidebarTreeBuilder.buildRows(
            workspace: ws,
            collapsedNodeIDs: [],
            searchQuery: ""
        )

        #expect(rows.map(\.id) == [
            .collection("col-1"),
            .folder("fol-sys"),
            .request("req-sys"),
            .folder("fol-users"),
            .folder("fol-sub"),
            .request("req-login"),
            .request("req-profile"),
            .request("req-col"),
            .collection("col-empty"),
            .folder("fol-orphan"),
            .request("req-orphan"),
            .sectionHeader("unfiled-requests"),
            .request("req-unfiled"),
        ])

        #expect(rows.first(where: { $0.id == .collection("col-1") })?.depth == 0)
        #expect(rows.first(where: { $0.id == .folder("fol-users") })?.depth == 1)
        #expect(rows.first(where: { $0.id == .folder("fol-sub") })?.depth == 2)
        #expect(rows.first(where: { $0.id == .request("req-login") })?.depth == 3)
        #expect(rows.first(where: { $0.id == .folder("fol-orphan") })?.depth == 0)
        #expect(rows.first(where: { $0.id == .request("req-orphan") })?.depth == 1)
        #expect(rows.first(where: { $0.id == .request("req-unfiled") })?.depth == 1)
    }

    @Test("Collapsing a collection or folder hides descendants without losing nested collapse state")
    func collapsingHidesDescendants() {
        let ws = sampleWorkspace()
        let rows = SidebarTreeBuilder.buildRows(
            workspace: ws,
            collapsedNodeIDs: [.folder("fol-users")],
            searchQuery: ""
        )

        #expect(rows.contains(where: { $0.id == .folder("fol-users") && !$0.isExpanded }))
        #expect(!rows.contains(where: { $0.id == .folder("fol-sub") }))
        #expect(!rows.contains(where: { $0.id == .request("req-login") }))
        #expect(!rows.contains(where: { $0.id == .request("req-profile") }))
        #expect(rows.contains(where: { $0.id == .request("req-sys") }))
    }

    @Test("Search filter auto-expands matching branches without mutating collapsedNodeIDs")
    func searchAutoExpandsMatchingAncestors() {
        let ws = sampleWorkspace()
        let collapsed: Set<SidebarNodeID> = [
            .collection("col-1"),
            .folder("fol-users"),
            .folder("fol-sub"),
            .folder("fol-sys"),
        ]

        let rows = SidebarTreeBuilder.buildRows(
            workspace: ws,
            collapsedNodeIDs: collapsed,
            searchQuery: "login"
        )

        #expect(rows.map(\.id) == [
            .collection("col-1"),
            .folder("fol-users"),
            .folder("fol-sub"),
            .request("req-login"),
        ])
        #expect(rows.allSatisfy { !$0.isCollapsible || $0.isExpanded })
    }

    @Test("AppState toggleCollapseExpandAll collapses all containers when any expanded, then expands all")
    func toggleCollapseExpandAllCycle() {
        let bridge = SidebarMockBridge(workspace: sampleWorkspace())
        let state = AppState(bridge: bridge)
        state.workspace = sampleWorkspace()

        #expect(!state.areAllSidebarNodesCollapsed)
        #expect(state.allCollapsibleSidebarNodeIDs == [
            .collection("col-1"),
            .collection("col-empty"),
            .folder("fol-sys"),
            .folder("fol-users"),
            .folder("fol-sub"),
            .folder("fol-orphan"),
        ])

        state.setSidebarNodeExpanded(.folder("fol-sys"), expanded: false)
        #expect(!state.areAllSidebarNodesCollapsed)

        state.toggleCollapseExpandAll()
        #expect(state.areAllSidebarNodesCollapsed)
        #expect(state.collapsedSidebarNodeIDs == state.allCollapsibleSidebarNodeIDs)

        state.toggleCollapseExpandAll()
        #expect(!state.areAllSidebarNodesCollapsed)
        #expect(state.collapsedSidebarNodeIDs.isEmpty)
    }

    @Test("Per-collection toggleCollapseExpandFolders collapses and expands only that collection's folders")
    func perCollectionFolderToggle() {
        let ws = sampleWorkspace()
        let bridge = SidebarMockBridge(workspace: ws)
        let state = AppState(bridge: bridge)
        state.workspace = ws

        #expect(SidebarTreeBuilder.folderNodeIDs(inCollection: "col-1", workspace: ws) == [
            .folder("fol-sys"),
            .folder("fol-users"),
            .folder("fol-sub"),
        ])
        #expect(SidebarTreeBuilder.folderNodeIDs(inCollection: "col-empty", workspace: ws).isEmpty)
        #expect(!state.areAllFoldersCollapsed(inCollection: "col-1"))
        #expect(!state.areAllFoldersCollapsed(inCollection: "col-empty"))

        // Collapse folders inside col-1 (even if col-1 was collapsed, keep col-1 open so folders show)
        state.collapsedSidebarNodeIDs = [.collection("col-1")]
        state.toggleCollapseExpandFolders(inCollection: "col-1")
        #expect(state.areAllFoldersCollapsed(inCollection: "col-1"))
        #expect(!state.collapsedSidebarNodeIDs.contains(.collection("col-1")))
        #expect(state.collapsedSidebarNodeIDs.contains(.folder("fol-sys")))
        #expect(state.collapsedSidebarNodeIDs.contains(.folder("fol-users")))
        #expect(state.collapsedSidebarNodeIDs.contains(.folder("fol-sub")))
        #expect(!state.collapsedSidebarNodeIDs.contains(.folder("fol-orphan")))

        // Expand folders inside col-1 (and ensure col-1 itself expands if collapsed)
        state.collapsedSidebarNodeIDs.insert(.collection("col-1"))
        state.toggleCollapseExpandFolders(inCollection: "col-1")
        #expect(!state.areAllFoldersCollapsed(inCollection: "col-1"))
        #expect(!state.collapsedSidebarNodeIDs.contains(.collection("col-1")))
        #expect(!state.collapsedSidebarNodeIDs.contains(.folder("fol-sys")))
        #expect(!state.collapsedSidebarNodeIDs.contains(.folder("fol-users")))
        #expect(!state.collapsedSidebarNodeIDs.contains(.folder("fol-sub")))
    }

    @Test("Creating a folder or request inside a collapsed parent expands the parent container")
    func creatingChildExpandsCollapsedParent() async {
        let ws = sampleWorkspace()
        let bridge = SidebarMockBridge(workspace: ws)
        let state = AppState(bridge: bridge)
        state.workspace = ws
        state.collapsedSidebarNodeIDs = [.collection("col-1"), .folder("fol-users")]

        await state.createFolder(name: "Sessions", collectionId: "col-1", parentId: "fol-users")
        #expect(!state.collapsedSidebarNodeIDs.contains(.collection("col-1")))
        #expect(!state.collapsedSidebarNodeIDs.contains(.folder("fol-users")))

        state.collapsedSidebarNodeIDs = [.folder("fol-sys")]
        await state.createRequestInFolder(folderId: "fol-sys")
        #expect(!state.collapsedSidebarNodeIDs.contains(.folder("fol-sys")))
    }

    @Test("AppState.renameRequest trims whitespace, ignores empty/unchanged, persists, and preserves dirty tab edits")
    func renameRequestPersistenceAndDirtyTabSync() async {
        var ws = sampleWorkspace()
        let bridge = SidebarMockBridge(workspace: ws)
        let state = AppState(bridge: bridge)
        state.workspace = ws

        guard let original = ws.requests.first(where: { $0.id == "req-profile" }) else {
            Issue.record("Missing fixture request")
            return
        }
        state.openRequest(original)
        state.updateActiveRequest {
            $0.url = "https://api.test/users/me?edited=true"
            $0.body = "{\"draft\":true}"
        }
        #expect(state.activeTab?.isDirty == true)

        // Empty or whitespace-only should do nothing
        await state.renameRequest(id: "req-profile", name: "   \n ")
        #expect(await bridge.savedRequests.isEmpty)

        // Unchanged name should do nothing
        await state.renameRequest(id: "req-profile", name: "  Fetch profile ")
        #expect(await bridge.savedRequests.isEmpty)

        // Valid rename should persist using persisted workspace copy (not dirty URL/body),
        // while updating matching open tab's name and preserving dirty edits
        await state.renameRequest(id: "req-profile", name: "  Get Current User  ")
        let saved = await bridge.savedRequests
        #expect(saved.count == 1)
        #expect(saved.first?.name == "Get Current User")
        #expect(saved.first?.url == "https://api.test/users/me")

        #expect(state.workspace?.requests.first(where: { $0.id == "req-profile" })?.name == "Get Current User")
        #expect(state.activeTab?.request.name == "Get Current User")
        #expect(state.activeTab?.title == "Get Current User")
        #expect(state.activeTab?.isDirty == true)
        #expect(state.activeTab?.request.url == "https://api.test/users/me?edited=true")
        #expect(state.activeTab?.request.body == "{\"draft\":true}")

        // Update mock workspace for any later assertion
        ws.requests[2].name = "Get Current User"
    }

    @Test("AppState.duplicateRequest clones fields, isolates Keychain secrets, copies scripts, and opens new tab")
    func duplicateRequestClonesAndIsolatesSecrets() async {
        var ws = sampleWorkspace()
        let sourceRef = "kobeanrest://secrets/auth-req-login/token"
        if let idx = ws.requests.firstIndex(where: { $0.id == "req-login" }) {
            ws.requests[idx].headers = [HeaderEntry(key: "X-Custom", value: "abc", enabled: true)]
            ws.requests[idx].body = "{\"hello\":\"world\"}"
            ws.requests[idx].bodyMimeType = "application/json"
            ws.requests[idx].authMode = "bearer"
            ws.requests[idx].setAuthConfig(AuthConfig(token: sourceRef))
        }

        let bridge = SidebarMockBridge(
            workspace: ws,
            secrets: [sourceRef: "super-secret-token"],
            scripts: [
                ScriptRecord(id: "s1", entityId: "req-login", entityType: "request", scriptType: "pre", content: "kb.log('pre')", position: 0),
                ScriptRecord(id: "s2", entityId: "req-login", entityType: "request", scriptType: "post", content: "pm.test('ok', () => {})", position: 1),
            ]
        )
        let state = AppState(bridge: bridge)
        state.workspace = ws
        state.collapsedSidebarNodeIDs = [.folder("fol-sub")]

        await state.duplicateRequest(id: "req-login")

        let duplicates = state.workspace?.requests.filter { $0.folderId == "fol-sub" && $0.id != "req-login" } ?? []
        #expect(duplicates.count == 1)
        let dup = duplicates[0]
        #expect(dup.name == "Login (copy)")
        #expect(dup.method == "POST")
        #expect(dup.url == "https://api.test/auth/login")
        #expect(dup.body == "{\"hello\":\"world\"}")
        #expect(dup.headers.map(\.key) == ["X-Custom"])
        #expect(dup.authMode == "bearer")

        // Keychain secret must be re-externalized under the new request's scope, never shared with source
        let dupTokenRef = dup.decodedAuthConfig.token
        #expect(dupTokenRef != nil)
        #expect(dupTokenRef != sourceRef)
        #expect(dupTokenRef?.contains("auth-\(dup.id)") == true)
        let storedSecrets = await bridge.secrets
        #expect(dupTokenRef.flatMap { storedSecrets[$0] } == "super-secret-token")

        // Pre/post scripts copied to new request
        let dupScripts = try? await bridge.getScripts(entityId: dup.id, entityType: "request")
        #expect(dupScripts?.count == 2)
        #expect(dupScripts?.first(where: { $0.scriptType == "pre" })?.content == "kb.log('pre')")

        // Parent expanded & new tab selected
        #expect(!state.collapsedSidebarNodeIDs.contains(.folder("fol-sub")))
        #expect(state.activeTab?.request.id == dup.id)
    }
}

private actor SidebarMockBridge: CoreBridgeProtocol {
    nonisolated let dataDirectoryURL: URL = FileManager.default.temporaryDirectory
    private var workspace: WorkspaceSummary
    private(set) var savedRequests: [SavedRequest] = []
    private(set) var secrets: [String: String]
    private var scripts: [ScriptRecord]

    init(
        workspace: WorkspaceSummary,
        secrets: [String: String] = [:],
        scripts: [ScriptRecord] = []
    ) {
        self.workspace = workspace
        self.secrets = secrets
        self.scripts = scripts
    }

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
    func loadWorkspace() async throws -> WorkspaceSummary { workspace }
    func listWorkspaces() async throws -> [WorkspaceListItem] { [WorkspaceListItem(id: workspace.id, name: workspace.name)] }
    func loadWorkspace(id: String) async throws -> WorkspaceSummary { workspace }
    func switchWorkspace(id: String) async throws -> WorkspaceSummary { workspace }
    func createWorkspace(name: String) async throws -> String { "ws-new" }
    func renameWorkspace(id: String, name: String) async throws {}
    func deleteWorkspace(id: String) async throws {}
    func createCollection(name: String, workspaceId: String?) async throws -> String { "col-new" }
    func updateCollection(id: String, name: String) async throws {}
    func deleteCollection(id: String) async throws {}
    func saveCollectionAuth(id: String, authMode: String, authConfig: AuthConfig) async throws {}
    func createFolder(name: String, collectionId: String?, parentId: String?) async throws -> FolderSummary {
        let f = FolderSummary(id: "fol-\(UUID().uuidString)", name: name, collectionId: collectionId, parentId: parentId)
        workspace.folders.append(f)
        return f
    }
    func updateFolder(id: String, name: String) async throws {}
    func deleteFolder(id: String) async throws {}
    func saveFolderAuth(id: String, authMode: String, authConfig: AuthConfig) async throws {}
    func createRequest(folderId: String) async throws -> SavedRequest {
        let req = SavedRequest(id: "req-\(UUID().uuidString)", name: "New Request", method: "GET", url: "", folderId: folderId)
        workspace.requests.append(req)
        return req
    }
    func saveRequest(_ request: SavedRequest) async throws {
        savedRequests.append(request)
        if let idx = workspace.requests.firstIndex(where: { $0.id == request.id }) {
            workspace.requests[idx] = request
        }
    }
    func deleteRequest(id: String) async throws {}
    func createEnvironment(name: String) async throws -> EnvironmentSummary { EnvironmentSummary(name: name) }
    func renameEnvironment(oldName: String, newName: String) async throws {}
    func deleteEnvironment(name: String) async throws {}
    func setActiveEnvironment(name: String) async throws {}
    func saveVariable(environmentName: String, key: String, value: String, masked: Bool?) async throws {}
    func saveSecretVariable(environmentName: String, key: String, value: String, scope: String) async throws -> String { "" }
    func deleteVariable(environmentName: String, key: String, secretRef: String?) async throws {}
    func storeSecret(scope: String, key: String, value: String) async throws -> String {
        let ref = "kobeanrest://secrets/\(scope)/\(key)"
        secrets[ref] = value
        return ref
    }
    func resolveSecrets(refIds: [String]) async throws -> [String: String] {
        var out: [String: String] = [:]
        for ref in refIds {
            if let value = secrets[ref] {
                out[ref] = value
            }
        }
        return out
    }
    func deleteSecret(refId: String) async throws {
        secrets.removeValue(forKey: refId)
    }
    func resolveEnvironmentSecretValues(workspace: WorkspaceSummary) async -> [String: String] { [:] }
    func buildScopedVariableMap(request: SavedRequest, workspace: WorkspaceSummary) async throws -> [String: String] { [:] }
    func getScripts(entityId: String, entityType: String) async throws -> [ScriptRecord] {
        scripts.filter { $0.entityId == entityId && $0.entityType == entityType }
    }
    func getAllScripts() async throws -> [ScriptRecord] { scripts }
    func saveScript(entityId: String, entityType: String, scriptType: String, content: String) async throws {
        if let idx = scripts.firstIndex(where: {
            $0.entityId == entityId && $0.entityType == entityType && $0.scriptType == scriptType
        }) {
            scripts[idx].content = content
        } else {
            scripts.append(ScriptRecord(
                id: "s-\(UUID().uuidString)",
                entityId: entityId,
                entityType: entityType,
                scriptType: scriptType,
                content: content,
                position: Int64(scripts.count)
            ))
        }
    }
    func deleteScript(scriptId: String) async throws {}
    func prepareAndExecuteRequest(
        request: SavedRequest,
        workspace: WorkspaceSummary,
        variableOverrides: [String: String],
        customMethod: String?
    ) async throws -> PreparedExecutionResult {
        throw CoreBridgeError.invalidData("Unused in test")
    }
    func loadRequestHistory() async throws -> [HistoryEntry] { [] }
    func loadHistoryResponse(id: Int64) async throws -> HistoryResponsePayload { HistoryResponsePayload() }
    func recordRequestHistory(_ entry: RequestHistoryEntry) async throws {}
    func clearRequestHistory() async throws {}
    func redactUrlForHistory(_ url: String, authMode: String, authConfig: AuthConfig) async throws -> String { url }
    func redactHeadersForHistory(_ headers: [HeaderEntry], authMode: String, authConfig: AuthConfig) async throws -> [HeaderEntry] { headers }
    func loadAppSettings() async throws -> AppSettings { .default }
    func saveAppSettings(_ settings: AppSettings) async throws {}
    func extractPathVariables(url: String) async -> [String] { [] }
    func syncPathVariables(url: String, existing: [PathVariableEntry]?) async throws -> [PathVariableEntry] { [] }
    func detectImportFormat(content: String) async -> String { "unknown" }
    func parseUniversalImport(content: String, defaultWorkspaceName: String?) async throws -> NormalizedImportResult {
        NormalizedImportResult(format: "unknown", formatLabel: "Unknown", title: "", stats: ImportStats(), exportDataJson: "{}")
    }
    func parseCurlCommand(raw: String) async throws -> CurlImportResult {
        throw CoreBridgeError.invalidData("Unused in test")
    }
    func importWorkspaceData(json: String) async throws {}
    func exportWorkspaceData() async throws -> String { "{}" }
}

