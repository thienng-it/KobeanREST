import AppKit
import Foundation
import Observation
import UniformTypeIdentifiers
import os

@Observable
@MainActor
public final class AppState {
    public let bridge: any CoreBridgeProtocol

    public var workspace: WorkspaceSummary?
    public var workspaces: [WorkspaceListItem] = []
    public var tabs: [RequestTab] = []
    public var selectedTabID: UUID?
    public var history: [HistoryEntry] = []
    public var settings: AppSettings = .default

    public var sidebarSection: SidebarSection = .collections
    public var searchQuery: String = ""
    public var splitOrientation: SplitOrientation = .horizontal

    public var isLoadingWorkspace: Bool = false
    public var workspaceError: String?
    public var statusMessage: String?

    public var isEnvironmentSheetPresented: Bool = false
    public var isImportSheetPresented: Bool = false
    public var isSnippetSheetPresented: Bool = false
    public var isMockServerSheetPresented: Bool = false
    public var isRunnerSheetPresented: Bool = false
    public var isMcpSheetPresented: Bool = false
    public var isAuthorizingOAuth: Bool = false
    public var urlFocusTrigger: UUID = UUID()

    private var inFlightTasks: [UUID: Task<Void, Never>] = [:]
    private let oauthService: OAuthSessionService
    private let logger = Logger(subsystem: "com.kobeanrest.app", category: "AppState")

    public init(
        bridge: any CoreBridgeProtocol = CoreBridge(),
        oauthService: OAuthSessionService = OAuthSessionService()
    ) {
        self.bridge = bridge
        self.oauthService = oauthService
    }

    public var activeTabIndex: Int? {
        guard let selectedTabID else { return nil }
        return tabs.firstIndex(where: { $0.id == selectedTabID })
    }

    public var activeTab: RequestTab? {
        guard let idx = activeTabIndex else { return nil }
        return tabs[idx]
    }

    // MARK: - Bootstrap & Workspace

    public func bootstrap() async {
        isLoadingWorkspace = true
        workspaceError = nil
        defer { isLoadingWorkspace = false }

        do {
            _ = try await bridge.initializePersistence()
            async let loadedWorkspace = bridge.loadWorkspace()
            async let loadedWorkspaces = bridge.listWorkspaces()
            async let loadedSettings = bridge.loadAppSettings()
            async let loadedHistory = bridge.loadRequestHistory()

            self.workspace = try await loadedWorkspace
            self.workspaces = try await loadedWorkspaces
            self.settings = (try? await loadedSettings) ?? .default
            self.history = (try? await loadedHistory) ?? []

            if tabs.isEmpty {
                if let firstRequest = workspace?.requests.first {
                    openRequest(firstRequest)
                } else {
                    createNewTab()
                }
            }
        } catch {
            workspaceError = error.localizedDescription
            logger.error("Bootstrap failed: \(error.localizedDescription, privacy: .private)")
        }
    }

    public func refreshWorkspace() async {
        do {
            async let loaded = bridge.loadWorkspace()
            async let list = bridge.listWorkspaces()
            self.workspace = try await loaded
            self.workspaces = try await list
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    public func switchWorkspace(id: String) async {
        cancelAllInFlight()
        isLoadingWorkspace = true
        workspaceError = nil
        defer { isLoadingWorkspace = false }

        do {
            let switched = try await bridge.switchWorkspace(id: id)
            self.workspace = switched
            self.workspaces = try await bridge.listWorkspaces()
            self.history = (try? await bridge.loadRequestHistory()) ?? []
            self.tabs = []
            self.selectedTabID = nil
            if let first = switched.requests.first {
                openRequest(first)
            } else {
                createNewTab()
            }
        } catch {
            workspaceError = error.localizedDescription
        }
    }

    public func createWorkspace(name: String) async {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        do {
            let newId = try await bridge.createWorkspace(name: trimmed)
            await switchWorkspace(id: newId)
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    // MARK: - Tabs

    public func openRequest(_ request: SavedRequest) {
        if let existing = tabs.first(where: { $0.request.id == request.id && $0.isPersisted }) {
            selectedTabID = existing.id
            return
        }
        let tab = RequestTab(request: request, isDirty: false, isPersisted: true)
        tabs.append(tab)
        selectedTabID = tab.id

        let tabID = tab.id
        let requestID = request.id
        Task { [weak self] in
            await self?.loadScriptsForTab(tabID: tabID, requestID: requestID)
        }
    }

    private func loadScriptsForTab(tabID: UUID, requestID: String) async {
        guard !requestID.isEmpty,
              !requestID.hasPrefix("draft-"),
              !requestID.hasPrefix("history-"),
              let scripts = try? await bridge.getScripts(entityId: requestID, entityType: "request") else {
            return
        }
        let pre = scripts.first(where: { $0.scriptType == "pre" })?.content ?? ""
        let post = scripts.first(where: { $0.scriptType == "post" })?.content ?? ""
        updateTab(id: tabID) { target in
            if !target.isDirty {
                target.preScript = pre
                target.postScript = post
            }
        }
    }

    @discardableResult
    public func createNewTab(inFolderID folderID: String = "") -> UUID {
        let resolvedFolder = folderID.isEmpty ? (workspace?.folders.first?.id ?? "") : folderID
        let tab = RequestTab(
            request: SavedRequest.draft(folderID: resolvedFolder),
            isDirty: false,
            isPersisted: false
        )
        tabs.append(tab)
        selectedTabID = tab.id
        return tab.id
    }

    public func closeTab(id: UUID) {
        inFlightTasks[id]?.cancel()
        inFlightTasks.removeValue(forKey: id)
        guard let idx = tabs.firstIndex(where: { $0.id == id }) else { return }
        tabs.remove(at: idx)
        if selectedTabID == id {
            if tabs.isEmpty {
                selectedTabID = nil
            } else {
                let nextIndex = min(idx, tabs.count - 1)
                selectedTabID = tabs[nextIndex].id
            }
        }
    }

    public func closeActiveTab() {
        guard let selectedTabID else { return }
        closeTab(id: selectedTabID)
    }

    public func focusURLBar() {
        urlFocusTrigger = UUID()
    }

    public func toggleSplitOrientation() {
        splitOrientation = (splitOrientation == .horizontal) ? .vertical : .horizontal
    }

    public func updateActiveRequest(_ mutate: (inout SavedRequest) -> Void) {
        guard let idx = activeTabIndex else { return }
        mutate(&tabs[idx].request)
        tabs[idx].isDirty = true
    }

    public func updateTab(id: UUID, _ mutate: (inout RequestTab) -> Void) {
        guard let idx = tabs.firstIndex(where: { $0.id == id }) else { return }
        mutate(&tabs[idx])
    }

    public func syncPathVariablesForActiveTab() async {
        guard let tab = activeTab else { return }
        let tabID = tab.id
        let url = tab.request.url
        let existing = tab.request.pathVariables
        do {
            let synced = try await bridge.syncPathVariables(url: url, existing: existing)
            guard let idx = tabs.firstIndex(where: { $0.id == tabID }) else { return }
            if tabs[idx].request.pathVariables != synced {
                tabs[idx].request.pathVariables = synced.isEmpty ? nil : synced
            }
        } catch {
            logger.debug("Path variable sync skipped: \(error.localizedDescription, privacy: .private)")
        }
    }

    // MARK: - Save & Execute

    public func saveActiveTab() async {
        guard let idx = activeTabIndex else { return }
        var tab = tabs[idx]

        do {
            if !tab.isPersisted {
                var folderId = tab.request.folderId
                if folderId.isEmpty {
                    if let existingFolder = workspace?.folders.first?.id {
                        folderId = existingFolder
                    } else if let existingCollection = workspace?.collections?.first?.id {
                        let createdFolder = try await bridge.createFolder(
                            name: "Requests",
                            collectionId: existingCollection,
                            parentId: nil
                        )
                        folderId = createdFolder.id
                    } else {
                        let collectionId = try await bridge.createCollection(
                            name: "Default Collection",
                            workspaceId: workspace?.id
                        )
                        let createdFolder = try await bridge.createFolder(
                            name: "Requests",
                            collectionId: collectionId,
                            parentId: nil
                        )
                        folderId = createdFolder.id
                    }
                }
                let created = try await bridge.createRequest(folderId: folderId)
                var merged = tab.request
                merged.id = created.id
                merged.folderId = created.folderId
                try await externalizeAuthSecrets(request: &merged)
                try await bridge.saveRequest(merged)
                try await persistScriptsForRequest(
                    requestId: merged.id,
                    preScript: tab.preScript,
                    postScript: tab.postScript
                )
                tab.request = merged
                tab.isPersisted = true
                tab.isDirty = false
            } else {
                var requestToSave = tab.request
                try await externalizeAuthSecrets(request: &requestToSave)
                try await bridge.saveRequest(requestToSave)
                try await persistScriptsForRequest(
                    requestId: requestToSave.id,
                    preScript: tab.preScript,
                    postScript: tab.postScript
                )
                tab.request = requestToSave
                tab.isDirty = false
            }

            if let currentIdx = tabs.firstIndex(where: { $0.id == tab.id }) {
                tabs[currentIdx] = tab
            }
            await refreshWorkspace()
        } catch {
            statusMessage = "Save failed: \(error.localizedDescription)"
        }
    }

    private func persistScriptsForRequest(
        requestId: String,
        preScript: String,
        postScript: String
    ) async throws {
        let existing = (try? await bridge.getScripts(entityId: requestId, entityType: "request")) ?? []
        let pairs: [(type: String, content: String)] = [("pre", preScript), ("post", postScript)]
        for pair in pairs {
            if !pair.content.isEmpty {
                try await bridge.saveScript(
                    entityId: requestId,
                    entityType: "request",
                    scriptType: pair.type,
                    content: pair.content
                )
            } else if let old = existing.first(where: { $0.scriptType == pair.type }) {
                try await bridge.deleteScript(scriptId: old.id)
            }
        }
    }

    public func sendActiveTab() {
        guard let idx = activeTabIndex else { return }
        let tab = tabs[idx]
        let tabID = tab.id

        let trimmedURL = tab.request.url.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedURL.isEmpty else {
            tabs[idx].responseState = .error("Enter a request URL before sending.")
            return
        }

        inFlightTasks[tabID]?.cancel()
        tabs[idx].responseState = .loading(startedAt: Date())
        tabs[idx].testResults = []
        tabs[idx].scriptLogs = []

        let currentWorkspace = workspace ?? WorkspaceSummary(id: "default", name: "Workspace")
        let requestSnapshot = tab.request
        let customMethod = tab.customMethod.isEmpty ? nil : tab.customMethod
        let preScript = tab.preScript
        let postScript = tab.postScript

        let task = Task { [weak self] in
            guard let self else { return }
            do {
                var requestToSend = requestSnapshot
                var effectiveCustomMethod = customMethod
                var variableOverrides: [String: String] = [:]
                var allLogs: [ScriptLogEntry] = []

                let hasPreScript = !preScript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                let hasPostScript = !postScript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty

                var scopedVariables: [String: String] = [:]
                var envVariables: [String: String] = [:]
                if hasPreScript || hasPostScript {
                    scopedVariables = (try? await self.bridge.buildScopedVariableMap(
                        request: requestSnapshot,
                        workspace: currentWorkspace
                    )) ?? [:]
                    envVariables = self.buildEnvironmentVariableMap(workspace: currentWorkspace)
                }

                if hasPreScript {
                    let initialScriptReq = self.makeScriptRequestSnapshot(
                        request: requestToSend,
                        customMethod: effectiveCustomMethod
                    )
                    let preResult = await ScriptRuntime.execute(
                        ScriptExecutionInput(
                            script: preScript,
                            phase: .preRequest,
                            request: initialScriptReq,
                            variables: scopedVariables,
                            environmentVariables: envVariables
                        )
                    )
                    guard !Task.isCancelled else { return }
                    allLogs.append(contentsOf: preResult.consoleLogs)

                    for (k, v) in preResult.updatedVariables {
                        scopedVariables[k] = v
                        variableOverrides[k] = v
                    }
                    for k in preResult.unsetVariables {
                        scopedVariables.removeValue(forKey: k)
                        variableOverrides.removeValue(forKey: k)
                    }
                    for (k, v) in preResult.updatedEnvVariables {
                        envVariables[k] = v
                        variableOverrides[k] = v
                    }
                    for k in preResult.unsetEnvVariables {
                        envVariables.removeValue(forKey: k)
                        variableOverrides.removeValue(forKey: k)
                    }

                    await self.persistScriptEnvironmentChanges(
                        updated: preResult.updatedEnvVariables,
                        unset: preResult.unsetEnvVariables,
                        workspace: currentWorkspace
                    )

                    if preResult.skippedRequest {
                        self.updateTab(id: tabID) { target in
                            target.responseState = .idle
                            target.scriptLogs = allLogs
                            target.testResults = []
                        }
                        self.statusMessage = "Request skipped by pre-request script."
                        self.inFlightTasks.removeValue(forKey: tabID)
                        return
                    }

                    if let scriptError = preResult.error {
                        allLogs.append(ScriptLogEntry(level: .error, message: scriptError))
                        self.updateTab(id: tabID) { target in
                            target.responseState = .error("Pre-request script error: \(scriptError)")
                            target.scriptLogs = allLogs
                        }
                        self.inFlightTasks.removeValue(forKey: tabID)
                        return
                    }

                    Self.applyMutatedScriptRequest(
                        preResult.mutatedRequest,
                        to: &requestToSend,
                        customMethod: &effectiveCustomMethod
                    )
                }

                let result = try await self.bridge.prepareAndExecuteRequest(
                    request: requestToSend,
                    workspace: currentWorkspace,
                    variableOverrides: variableOverrides,
                    customMethod: effectiveCustomMethod
                )
                guard !Task.isCancelled else { return }

                var finalTestResults: [ScriptTestResult] = []
                var envModified = false

                if hasPostScript {
                    let postReqSnapshot = self.makeScriptRequestSnapshot(
                        request: requestToSend,
                        customMethod: effectiveCustomMethod
                    )
                    let postRespSnapshot = ScriptResponseSnapshot(
                        status: Int(result.response.status),
                        statusText: result.response.statusText,
                        headers: result.response.headers.map {
                            ScriptHeader(key: $0.key, value: $0.value, enabled: $0.enabled)
                        },
                        body: result.response.bodyText ?? "",
                        durationMs: Double(result.response.durationMs),
                        sizeBytes: result.response.sizeBytes
                    )
                    let postResult = await ScriptRuntime.execute(
                        ScriptExecutionInput(
                            script: postScript,
                            phase: .postResponse,
                            request: postReqSnapshot,
                            response: postRespSnapshot,
                            variables: scopedVariables,
                            environmentVariables: envVariables
                        )
                    )
                    guard !Task.isCancelled else { return }
                    allLogs.append(contentsOf: postResult.consoleLogs)
                    if let postError = postResult.error {
                        allLogs.append(ScriptLogEntry(level: .error, message: postError))
                    }
                    finalTestResults = postResult.testResults

                    if !postResult.updatedEnvVariables.isEmpty || !postResult.unsetEnvVariables.isEmpty {
                        await self.persistScriptEnvironmentChanges(
                            updated: postResult.updatedEnvVariables,
                            unset: postResult.unsetEnvVariables,
                            workspace: currentWorkspace
                        )
                        envModified = true
                    }
                }

                self.updateTab(id: tabID) { target in
                    target.responseState = .success(result.response)
                    target.testResults = finalTestResults
                    target.scriptLogs = allLogs
                }

                if envModified || hasPreScript {
                    await self.refreshWorkspace()
                }

                let sanitizedHeaders: [HeaderEntry]
                if let redacted = try? await self.bridge.redactHeadersForHistory(
                    result.response.headers,
                    authMode: result.prepared.effectiveAuthMode,
                    authConfig: result.prepared.effectiveAuthConfig
                ) {
                    sanitizedHeaders = redacted
                } else {
                    let apiKeyHeader = result.prepared.effectiveAuthMode == "apiKey"
                        ? result.prepared.effectiveAuthConfig.keyName
                        : nil
                    sanitizedHeaders = CoreBridge.sanitizeHeadersForHistory(
                        result.response.headers,
                        apiKeyHeaderName: apiKeyHeader
                    )
                }
                let headersJson: String? = {
                    guard let data = try? JSONEncoder().encode(sanitizedHeaders),
                          let str = String(data: data, encoding: .utf8) else { return nil }
                    return str
                }()

                let ffiRedactedURL = (try? await self.bridge.redactUrlForHistory(
                    result.prepared.historyUrl,
                    authMode: result.prepared.effectiveAuthMode,
                    authConfig: result.prepared.effectiveAuthConfig
                )) ?? result.prepared.historyUrl
                let sanitizedHistoryURL = CoreBridge.sanitizeHistoryURL(
                    ffiRedactedURL,
                    authMode: result.prepared.effectiveAuthMode,
                    authConfig: result.prepared.effectiveAuthConfig
                )

                var historyEntry = RequestHistoryEntry(
                    requestId: requestSnapshot.id,
                    workspaceId: currentWorkspace.id,
                    method: result.prepared.method,
                    url: sanitizedHistoryURL,
                    status: result.response.status,
                    durationMs: result.response.durationMs,
                    sizeBytes: result.response.sizeBytes,
                    responseHeaders: headersJson,
                    responseBodyText: result.response.bodyText,
                    responseBodyBase64: result.response.bodyBase64
                )
                if !finalTestResults.isEmpty {
                    let passedCount = Int64(finalTestResults.filter(\.passed).count)
                    let failedCount = Int64(finalTestResults.count) - passedCount
                    historyEntry.passedTests = passedCount
                    historyEntry.failedTests = failedCount
                    historyEntry.testPassed = failedCount == 0
                }
                try? await self.bridge.recordRequestHistory(historyEntry)
                await self.loadHistory()
            } catch is CancellationError {
                self.updateTab(id: tabID) { target in
                    if case .loading = target.responseState {
                        target.responseState = .idle
                    }
                }
            } catch {
                guard !Task.isCancelled else { return }
                self.updateTab(id: tabID) { target in
                    target.responseState = .error(error.localizedDescription)
                }
            }
            self.inFlightTasks.removeValue(forKey: tabID)
        }

        inFlightTasks[tabID] = task
    }

    func buildEnvironmentVariableMap(workspace: WorkspaceSummary) -> [String: String] {
        guard !workspace.activeEnvironment.isEmpty,
              let activeEnv = workspace.environments.first(where: { $0.name == workspace.activeEnvironment }) else {
            return [:]
        }
        var map: [String: String] = [:]
        for v in activeEnv.variables {
            let hasSecretRef = v.secretRef.map { !$0.isEmpty } ?? false
            if !v.secret && !hasSecretRef && !v.key.isEmpty {
                map[v.key] = v.value
            }
        }
        return map
    }

    private func persistScriptEnvironmentChanges(
        updated: [String: String],
        unset: [String],
        workspace: WorkspaceSummary
    ) async {
        let envName = workspace.activeEnvironment
        guard !envName.isEmpty else { return }
        let activeEnv = workspace.environments.first(where: { $0.name == envName })

        for (key, value) in updated {
            let trimmedKey = key.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmedKey.isEmpty else { continue }
            let existingVar = activeEnv?.variables.first(where: { $0.key == trimmedKey })
            let isSecret = existingVar?.secret == true || (existingVar?.secretRef?.isEmpty == false)
            if isSecret {
                // Never persist secret values in plaintext SQLite; route through Keychain instead.
                _ = try? await bridge.saveSecretVariable(
                    environmentName: envName,
                    key: trimmedKey,
                    value: value,
                    scope: "env-\(envName)"
                )
            } else {
                try? await bridge.saveVariable(
                    environmentName: envName,
                    key: trimmedKey,
                    value: value,
                    masked: existingVar?.masked
                )
            }
        }

        for key in unset {
            let existingVar = activeEnv?.variables.first(where: { $0.key == key })
            try? await bridge.deleteVariable(
                environmentName: envName,
                key: key,
                secretRef: existingVar?.secretRef
            )
        }
    }

    private func makeScriptRequestSnapshot(
        request: SavedRequest,
        customMethod: String?
    ) -> ScriptRequestSnapshot {
        let method = (request.method == HTTPMethod.custom.rawValue ? customMethod : nil) ?? request.method
        return ScriptRequestSnapshot(
            id: request.id,
            name: request.name,
            method: method,
            url: request.url,
            headers: request.headers.map { ScriptHeader(key: $0.key, value: $0.value, enabled: $0.enabled) },
            body: request.body,
            bodyMimeType: request.bodyMimeType
        )
    }

    private static func applyMutatedScriptRequest(
        _ mutated: ScriptRequestSnapshot,
        to request: inout SavedRequest,
        customMethod: inout String?
    ) {
        let upper = mutated.method.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if !upper.isEmpty {
            if let known = HTTPMethod(rawValue: upper), known != .custom {
                request.method = known.rawValue
                customMethod = nil
            } else {
                request.method = HTTPMethod.custom.rawValue
                customMethod = mutated.method
            }
        }
        request.url = mutated.url
        request.headers = mutated.headers.map {
            HeaderEntry(key: $0.key, value: $0.value, enabled: $0.enabled)
        }
        request.body = mutated.body
        request.bodyMimeType = mutated.bodyMimeType
    }

    public func cancelActiveTab() {
        guard let tabID = selectedTabID else { return }
        inFlightTasks[tabID]?.cancel()
        inFlightTasks.removeValue(forKey: tabID)
        updateTab(id: tabID) { target in
            if case .loading = target.responseState {
                target.responseState = .idle
            }
        }
    }

    private func cancelAllInFlight() {
        for task in inFlightTasks.values {
            task.cancel()
        }
        inFlightTasks.removeAll()
    }

    // MARK: - Collections, Folders & Requests CRUD

    public func createCollection(name: String) async {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        do {
            _ = try await bridge.createCollection(name: trimmed, workspaceId: workspace?.id)
            await refreshWorkspace()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    public func renameCollection(id: String, name: String) async {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        do {
            try await bridge.updateCollection(id: id, name: trimmed)
            await refreshWorkspace()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    public func deleteCollection(id: String) async {
        do {
            try await bridge.deleteCollection(id: id)
            await refreshWorkspace()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    public func createFolder(name: String, collectionId: String?, parentId: String?) async {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        do {
            _ = try await bridge.createFolder(name: trimmed, collectionId: collectionId, parentId: parentId)
            await refreshWorkspace()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    public func renameFolder(id: String, name: String) async {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        do {
            try await bridge.updateFolder(id: id, name: trimmed)
            await refreshWorkspace()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    public func deleteFolder(id: String) async {
        do {
            try await bridge.deleteFolder(id: id)
            await refreshWorkspace()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    public func createRequestInFolder(folderId: String) async {
        do {
            let req = try await bridge.createRequest(folderId: folderId)
            await refreshWorkspace()
            openRequest(req)
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    public func deleteRequest(id: String) async {
        do {
            try await bridge.deleteRequest(id: id)
            let matchingTabs = tabs.filter { $0.request.id == id }
            for tab in matchingTabs {
                closeTab(id: tab.id)
            }
            await refreshWorkspace()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    // MARK: - Environments & Keychain Secrets

    public func selectEnvironment(name: String) async {
        do {
            try await bridge.setActiveEnvironment(name: name)
            await refreshWorkspace()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    public func createEnvironment(name: String) async {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        do {
            _ = try await bridge.createEnvironment(name: trimmed)
            await refreshWorkspace()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    public func renameEnvironment(oldName: String, newName: String) async {
        let trimmed = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed != oldName else { return }
        do {
            try await bridge.renameEnvironment(oldName: oldName, newName: trimmed)
            await refreshWorkspace()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    public func deleteEnvironment(name: String) async {
        do {
            try await bridge.deleteEnvironment(name: name)
            await refreshWorkspace()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    public func saveVariable(environmentName: String, key: String, value: String, isSecret: Bool, masked: Bool) async {
        let trimmedKey = key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedKey.isEmpty else { return }
        do {
            if isSecret {
                let scope = "env-\(environmentName)"
                _ = try await bridge.saveSecretVariable(
                    environmentName: environmentName,
                    key: trimmedKey,
                    value: value,
                    scope: scope
                )
            } else {
                try await bridge.saveVariable(
                    environmentName: environmentName,
                    key: trimmedKey,
                    value: value,
                    masked: masked
                )
            }
            await refreshWorkspace()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    public func deleteVariable(environmentName: String, variable: EnvironmentVariable) async {
        do {
            try await bridge.deleteVariable(
                environmentName: environmentName,
                key: variable.key,
                secretRef: variable.secretRef
            )
            await refreshWorkspace()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    // MARK: - History, Import & Settings

    public func loadHistory() async {
        if let loaded = try? await bridge.loadRequestHistory() {
            self.history = loaded
        }
    }

    public func clearHistory() async {
        do {
            try await bridge.clearRequestHistory()
            self.history = []
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    public func openHistoryEntry(_ entry: HistoryEntry) async {
        let responsePayload = try? await bridge.loadHistoryResponse(id: entry.id)
        let headers: [HeaderEntry] = {
            guard let raw = responsePayload?.responseHeaders ?? entry.responseHeaders,
                  let data = raw.data(using: .utf8) else { return [] }
            return (try? JSONDecoder().decode([HeaderEntry].self, from: data)) ?? []
        }()

        let response = ExecuteHttpResponse(
            status: UInt16(clamping: max(0, entry.status)),
            statusText: HTTPURLResponse.localizedString(forStatusCode: Int(entry.status)).capitalized,
            headers: headers,
            bodyText: responsePayload?.responseBodyText ?? entry.responseBodyText,
            bodyBase64: responsePayload?.responseBodyBase64 ?? entry.responseBodyBase64,
            durationMs: UInt64(max(0, entry.durationMs)),
            sizeBytes: Int(max(0, entry.sizeBytes))
        )

        if let existing = workspace?.requests.first(where: { $0.id == entry.requestId }) {
            openRequest(existing)
            if let idx = activeTabIndex {
                tabs[idx].responseState = .success(response)
            }
        } else {
            let draft = SavedRequest(
                id: "history-\(entry.id)",
                name: entry.url,
                method: entry.method,
                url: entry.url
            )
            let tab = RequestTab(
                request: draft,
                isDirty: false,
                isPersisted: false,
                responseState: .success(response)
            )
            tabs.append(tab)
            selectedTabID = tab.id
        }
    }

    public func importUniversal(content: String) async throws -> NormalizedImportResult {
        let format = await bridge.detectImportFormat(content: content)
        if format == "curl" {
            let curl = try await bridge.parseCurlCommand(raw: content)
            var draft = SavedRequest.draft(folderID: workspace?.folders.first?.id ?? "")
            draft.name = curl.url.isEmpty ? "Imported cURL" : curl.url
            draft.method = curl.method
            draft.url = curl.url
            draft.headers = curl.headers
            draft.body = curl.body
            draft.bodyMimeType = curl.bodyMimeType
            draft.setBodyForm(curl.bodyForm)
            draft.authMode = curl.authMode
            draft.setAuthConfig(curl.authConfig)

            let tab = RequestTab(
                request: draft,
                customMethod: curl.customMethod ?? "",
                isDirty: true,
                isPersisted: false
            )
            tabs.append(tab)
            selectedTabID = tab.id

            return NormalizedImportResult(
                format: "curl",
                formatLabel: "cURL Command",
                title: draft.name,
                stats: ImportStats(requestsCount: 1),
                exportDataJson: "{}"
            )
        }

        let normalized = try await bridge.parseUniversalImport(
            content: content,
            defaultWorkspaceName: workspace?.name
        )
        try await bridge.importWorkspaceData(json: normalized.exportDataJson)
        await refreshWorkspace()
        return normalized
    }

    public func saveSettings(_ updated: AppSettings) async {
        self.settings = updated
        do {
            try await bridge.saveAppSettings(updated)
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    // MARK: - OAuth 2.0 Authorization & Refresh

    public func authorizeOAuth2ForActiveTab() async {
        guard !isAuthorizingOAuth, let tab = activeTab else { return }
        let tabID = tab.id
        let config = tab.request.decodedAuthConfig
        let currentWorkspace = workspace ?? WorkspaceSummary(id: "default", name: "Workspace")

        isAuthorizingOAuth = true
        defer { isAuthorizingOAuth = false }

        do {
            let varMap = await buildMergedVariableMapForAuth(request: tab.request, workspace: currentWorkspace)
            let grantType = OAuthGrantType(rawValue: config.grantType ?? "authorization_code") ?? .authorizationCode

            let resolvedTokenURLStr = Self.resolveVariables(config.accessTokenUrl, using: varMap)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard let tokenEndpoint = URL(string: resolvedTokenURLStr), !resolvedTokenURLStr.isEmpty else {
                statusMessage = "OAuth 2.0: Valid Access Token URL is required."
                return
            }

            let resolvedClientId = Self.resolveVariables(config.clientId, using: varMap)
            let resolvedClientSecret = try await resolveAuthSecretValue(
                config.clientSecret,
                using: varMap,
                fieldName: "clientSecret"
            )
            let resolvedScope = Self.resolveVariables(config.scope, using: varMap)
            let resolvedAudience = Self.resolveVariables(config.audience, using: varMap)

            let tokenResult: OAuthTokenResult
            switch grantType {
            case .authorizationCode:
                let resolvedAuthURLStr = Self.resolveVariables(config.authUrl, using: varMap)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                guard let authEndpoint = URL(string: resolvedAuthURLStr), !resolvedAuthURLStr.isEmpty else {
                    statusMessage = "OAuth 2.0: Valid Authorization URL is required."
                    return
                }
                guard let clientId = resolvedClientId, !clientId.isEmpty else {
                    statusMessage = "OAuth 2.0: Client ID is required."
                    return
                }
                let redirectRaw = Self.resolveVariables(config.redirectUri, using: varMap)?
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                let redirectStr = redirectRaw.flatMap { $0.isEmpty ? nil : $0 } ?? "kobeanrest://oauth/callback"
                guard let redirectURI = URL(string: redirectStr) else {
                    statusMessage = "OAuth 2.0: Invalid Redirect URI."
                    return
                }

                tokenResult = try await oauthService.authorizeAndExchangeCode(
                    authorizationEndpoint: authEndpoint,
                    tokenEndpoint: tokenEndpoint,
                    clientId: clientId,
                    clientSecret: resolvedClientSecret,
                    redirectURI: redirectURI,
                    scope: resolvedScope,
                    audience: resolvedAudience
                )

            case .clientCredentials:
                tokenResult = try await oauthService.exchangeToken(
                    .clientCredentials(
                        tokenEndpoint: tokenEndpoint,
                        clientId: resolvedClientId,
                        clientSecret: resolvedClientSecret,
                        scope: resolvedScope,
                        audience: resolvedAudience
                    )
                )

            case .passwordCredentials:
                let username = Self.resolveVariables(config.username, using: varMap) ?? ""
                let password = try await resolveAuthSecretValue(
                    config.password,
                    using: varMap,
                    fieldName: "password"
                ) ?? ""
                tokenResult = try await oauthService.exchangeToken(
                    .passwordCredentials(
                        tokenEndpoint: tokenEndpoint,
                        username: username,
                        password: password,
                        clientId: resolvedClientId,
                        clientSecret: resolvedClientSecret,
                        scope: resolvedScope,
                        audience: resolvedAudience
                    )
                )
            }

            var updatedRequest = tab.request
            var updatedCfg = updatedRequest.decodedAuthConfig
            updatedCfg.token = tokenResult.accessToken
            if let refresh = tokenResult.refreshToken, !refresh.isEmpty {
                updatedCfg.refreshToken = refresh
            }
            updatedCfg.expiresAt = tokenResult.expiresAtEpochMs
            updatedRequest.setAuthConfig(updatedCfg)
            try await externalizeAuthSecrets(request: &updatedRequest)

            updateTab(id: tabID) { target in
                target.request.authConfig = updatedRequest.authConfig
                target.isDirty = true
            }
            statusMessage = "OAuth 2.0 token acquired."
        } catch {
            statusMessage = "OAuth 2.0 failed: \(error.localizedDescription)"
        }
    }

    public func refreshOAuth2ForActiveTab() async {
        guard !isAuthorizingOAuth, let tab = activeTab else { return }
        let tabID = tab.id
        let config = tab.request.decodedAuthConfig
        let currentWorkspace = workspace ?? WorkspaceSummary(id: "default", name: "Workspace")

        isAuthorizingOAuth = true
        defer { isAuthorizingOAuth = false }

        do {
            let varMap = await buildMergedVariableMapForAuth(request: tab.request, workspace: currentWorkspace)
            let resolvedTokenURLStr = Self.resolveVariables(config.accessTokenUrl, using: varMap)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard let tokenEndpoint = URL(string: resolvedTokenURLStr), !resolvedTokenURLStr.isEmpty else {
                statusMessage = "OAuth 2.0: Valid Access Token URL is required to refresh."
                return
            }

            let resolvedRefresh = try await resolveAuthSecretValue(
                config.refreshToken,
                using: varMap,
                fieldName: "refreshToken"
            ) ?? ""
            guard !resolvedRefresh.isEmpty else {
                statusMessage = "OAuth 2.0: No refresh token available. Authorize first."
                return
            }

            let resolvedClientId = Self.resolveVariables(config.clientId, using: varMap)
            let resolvedClientSecret = try await resolveAuthSecretValue(
                config.clientSecret,
                using: varMap,
                fieldName: "clientSecret"
            )
            let resolvedScope = Self.resolveVariables(config.scope, using: varMap)

            let refreshed = try await oauthService.refreshToken(
                OAuthRefreshRequest(
                    tokenEndpoint: tokenEndpoint,
                    refreshToken: resolvedRefresh,
                    clientId: resolvedClientId,
                    clientSecret: resolvedClientSecret,
                    scope: resolvedScope
                )
            )

            var updatedRequest = tab.request
            var updatedCfg = updatedRequest.decodedAuthConfig
            updatedCfg.token = refreshed.accessToken
            if let nextRefresh = refreshed.refreshToken, !nextRefresh.isEmpty {
                updatedCfg.refreshToken = nextRefresh
            }
            updatedCfg.expiresAt = refreshed.expiresAtEpochMs
            updatedRequest.setAuthConfig(updatedCfg)
            try await externalizeAuthSecrets(request: &updatedRequest)

            updateTab(id: tabID) { target in
                target.request.authConfig = updatedRequest.authConfig
                target.isDirty = true
            }
            statusMessage = "OAuth 2.0 token refreshed."
        } catch {
            statusMessage = "OAuth 2.0 refresh failed: \(error.localizedDescription)"
        }
    }

    func externalizeAuthSecrets(request: inout SavedRequest) async throws {
        var cfg = request.decodedAuthConfig
        var changed = false
        let scope = "auth-\(request.id)"

        if let raw = Self.secretValueRequiringExternalization(cfg.clientSecret) {
            cfg.clientSecret = try await bridge.storeSecret(scope: scope, key: "clientSecret", value: raw)
            changed = true
        }
        if let raw = Self.secretValueRequiringExternalization(cfg.token) {
            cfg.token = try await bridge.storeSecret(scope: scope, key: "token", value: raw)
            changed = true
        }
        if let raw = Self.secretValueRequiringExternalization(cfg.refreshToken) {
            cfg.refreshToken = try await bridge.storeSecret(scope: scope, key: "refreshToken", value: raw)
            changed = true
        }
        if let raw = Self.secretValueRequiringExternalization(cfg.password) {
            cfg.password = try await bridge.storeSecret(scope: scope, key: "password", value: raw)
            changed = true
        }
        if let raw = Self.secretValueRequiringExternalization(cfg.keyValue) {
            cfg.keyValue = try await bridge.storeSecret(scope: scope, key: "keyValue", value: raw)
            changed = true
        }

        if changed {
            request.setAuthConfig(cfg)
        }
    }

    private static func secretValueRequiringExternalization(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        if value.hasPrefix(CoreBridge.secretReferencePrefix) { return nil }
        if value.contains("{{") && value.contains("}}") { return nil }
        if value == EnvironmentVariable.redactedPlaceholder { return nil }
        return value
    }

    private func buildMergedVariableMapForAuth(
        request: SavedRequest,
        workspace: WorkspaceSummary
    ) async -> [String: String] {
        var map = (try? await bridge.buildScopedVariableMap(request: request, workspace: workspace)) ?? [:]
        let secrets = await bridge.resolveEnvironmentSecretValues(workspace: workspace)
        for (k, v) in secrets {
            map[k] = v
        }
        return map
    }

    private func resolveAuthSecretValue(
        _ rawValue: String?,
        using varMap: [String: String],
        fieldName: String
    ) async throws -> String? {
        guard let rawValue, !rawValue.isEmpty else { return nil }
        if rawValue.hasPrefix(CoreBridge.secretReferencePrefix) {
            let resolved = try await bridge.resolveSecrets(refIds: [rawValue])
            guard let secret = resolved[rawValue], !secret.isEmpty else {
                throw CoreBridgeError.missingSecret(
                    "Missing or empty Keychain secret for \(fieldName)."
                )
            }
            return secret
        }
        return Self.resolveVariables(rawValue, using: varMap)
    }

    private static func resolveVariables(_ template: String?, using map: [String: String]) -> String? {
        guard let template, !template.isEmpty else { return nil }
        guard template.contains("{{") else { return template }
        var output = template
        for (key, value) in map {
            output = output.replacingOccurrences(of: "{{\(key)}}", with: value)
        }
        return output
    }

    // MARK: - Workspace Export

    public func exportWorkspaceToFile() async {
        do {
            let json = try await bridge.exportWorkspaceData()
            let panel = NSSavePanel()
            panel.allowedContentTypes = [.json]
            panel.canCreateDirectories = true
            let baseName = (workspace?.name ?? "kobeanrest-workspace")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            panel.nameFieldStringValue = "\(baseName.isEmpty ? "kobeanrest-workspace" : baseName).json"
            panel.title = "Export Workspace JSON"
            panel.message = "Secrets remain redacted according to your export security settings."

            let response = panel.runModal()
            guard response == .OK, let url = panel.url else { return }
            try Data(json.utf8).write(to: url, options: .atomic)
            statusMessage = "Exported workspace to \(url.lastPathComponent)"
        } catch {
            statusMessage = "Export failed: \(error.localizedDescription)"
        }
    }
}
