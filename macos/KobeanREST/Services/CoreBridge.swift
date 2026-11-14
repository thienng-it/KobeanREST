import Foundation
import os

public enum CoreBridgeError: LocalizedError, Sendable, Equatable {
    case ffi(String)
    case encoding(String)
    case decoding(String)
    case invalidData(String)
    case missingSecret(String)

    public var errorDescription: String? {
        switch self {
        case .ffi(let message),
             .encoding(let message),
             .decoding(let message),
             .invalidData(let message),
             .missingSecret(let message):
            return message
        }
    }
}

public struct PreparedExecutionResult: Sendable, Equatable {
    public let prepared: PreparedHttpRequest
    public let response: ExecuteHttpResponse

    public init(prepared: PreparedHttpRequest, response: ExecuteHttpResponse) {
        self.prepared = prepared
        self.response = response
    }
}

public protocol CoreBridgeProtocol: Sendable {
    var dataDirectoryURL: URL { get }

    func initializePersistence() async throws -> FfiPersistenceStatus
    func appContract() async -> FfiAppContract
    func localStorageStatus() async -> FfiLocalStorageStatus
    func requestAuthModes() async -> [String]

    func loadWorkspace() async throws -> WorkspaceSummary
    func listWorkspaces() async throws -> [WorkspaceListItem]
    func loadWorkspace(id: String) async throws -> WorkspaceSummary
    func switchWorkspace(id: String) async throws -> WorkspaceSummary
    func createWorkspace(name: String) async throws -> String
    func renameWorkspace(id: String, name: String) async throws
    func deleteWorkspace(id: String) async throws

    func createCollection(name: String, workspaceId: String?) async throws -> String
    func updateCollection(id: String, name: String) async throws
    func deleteCollection(id: String) async throws
    func saveCollectionAuth(id: String, authMode: String, authConfig: AuthConfig) async throws

    func createFolder(name: String, collectionId: String?, parentId: String?) async throws -> FolderSummary
    func updateFolder(id: String, name: String) async throws
    func deleteFolder(id: String) async throws
    func saveFolderAuth(id: String, authMode: String, authConfig: AuthConfig) async throws

    func createRequest(folderId: String) async throws -> SavedRequest
    func saveRequest(_ request: SavedRequest) async throws
    func deleteRequest(id: String) async throws

    func createEnvironment(name: String) async throws -> EnvironmentSummary
    func renameEnvironment(oldName: String, newName: String) async throws
    func deleteEnvironment(name: String) async throws
    func setActiveEnvironment(name: String) async throws
    func saveVariable(environmentName: String, key: String, value: String, masked: Bool?) async throws
    func saveSecretVariable(environmentName: String, key: String, value: String, scope: String) async throws -> String
    func deleteVariable(environmentName: String, key: String, secretRef: String?) async throws

    func storeSecret(scope: String, key: String, value: String) async throws -> String
    func resolveSecrets(refIds: [String]) async throws -> [String: String]
    func deleteSecret(refId: String) async throws
    func resolveEnvironmentSecretValues(workspace: WorkspaceSummary) async -> [String: String]
    func buildScopedVariableMap(request: SavedRequest, workspace: WorkspaceSummary) async throws -> [String: String]

    func getScripts(entityId: String, entityType: String) async throws -> [ScriptRecord]
    func getAllScripts() async throws -> [ScriptRecord]
    func saveScript(entityId: String, entityType: String, scriptType: String, content: String) async throws
    func deleteScript(scriptId: String) async throws

    func prepareAndExecuteRequest(
        request: SavedRequest,
        workspace: WorkspaceSummary,
        variableOverrides: [String: String],
        customMethod: String?
    ) async throws -> PreparedExecutionResult

    func loadRequestHistory() async throws -> [HistoryEntry]
    func loadHistoryResponse(id: Int64) async throws -> HistoryResponsePayload
    func recordRequestHistory(_ entry: RequestHistoryEntry) async throws
    func clearRequestHistory() async throws
    func redactUrlForHistory(_ url: String, authMode: String, authConfig: AuthConfig) async throws -> String
    func redactHeadersForHistory(_ headers: [HeaderEntry], authMode: String, authConfig: AuthConfig) async throws -> [HeaderEntry]

    func loadAppSettings() async throws -> AppSettings
    func saveAppSettings(_ settings: AppSettings) async throws

    func extractPathVariables(url: String) async -> [String]
    func syncPathVariables(url: String, existing: [PathVariableEntry]?) async throws -> [PathVariableEntry]
    func detectImportFormat(content: String) async -> String
    func parseUniversalImport(content: String, defaultWorkspaceName: String?) async throws -> NormalizedImportResult
    func parseCurlCommand(raw: String) async throws -> CurlImportResult
    func importWorkspaceData(json: String) async throws
    func exportWorkspaceData() async throws -> String
}

public actor CoreBridge: CoreBridgeProtocol {
    public nonisolated let dataDirectoryURL: URL

    private let logger = Logger(subsystem: "com.kobeanrest.app", category: "CoreBridge")
    private let encoder: JSONEncoder = {
        let enc = JSONEncoder()
        return enc
    }()
    private let decoder: JSONDecoder = {
        let dec = JSONDecoder()
        return dec
    }()

    public static var defaultDataDirectoryURL: URL {
        let appSupport = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first ?? FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support", isDirectory: true)
        return appSupport.appendingPathComponent("com.kobeanrest.app", isDirectory: true)
    }

    public init(dataDirectoryURL: URL = CoreBridge.defaultDataDirectoryURL) {
        self.dataDirectoryURL = dataDirectoryURL
    }

    private var dataDirPath: String {
        dataDirectoryURL.path
    }

    // MARK: - App Contract & Persistence

    public func initializePersistence() async throws -> FfiPersistenceStatus {
        let path = dataDirPath
        return try await runFFI {
            try ffiInitializePersistence(dataDir: path)
        }
    }

    public func appContract() async -> FfiAppContract {
        await Task.detached(priority: .userInitiated) {
            ffiAppContract()
        }.value
    }

    public func localStorageStatus() async -> FfiLocalStorageStatus {
        await Task.detached(priority: .userInitiated) {
            ffiLocalStorageStatus()
        }.value
    }

    public func requestAuthModes() async -> [String] {
        await Task.detached(priority: .userInitiated) {
            ffiRequestAuthModes()
        }.value
    }

    // MARK: - Workspace CRUD

    public func loadWorkspace() async throws -> WorkspaceSummary {
        let path = dataDirPath
        let json = try await runFFI {
            try loadWorkspaceJson(dataDir: path)
        }
        return try decode(WorkspaceSummary.self, from: json)
    }

    public func listWorkspaces() async throws -> [WorkspaceListItem] {
        let path = dataDirPath
        let json = try await runFFI {
            try listWorkspacesJson(dataDir: path)
        }
        return try decode([WorkspaceListItem].self, from: json)
    }

    public func loadWorkspace(id: String) async throws -> WorkspaceSummary {
        let path = dataDirPath
        let json = try await runFFI {
            try loadWorkspaceByIdJson(dataDir: path, workspaceId: id)
        }
        return try decode(WorkspaceSummary.self, from: json)
    }

    public func switchWorkspace(id: String) async throws -> WorkspaceSummary {
        let path = dataDirPath
        let json = try await runFFI {
            try switchWorkspaceJson(dataDir: path, workspaceId: id)
        }
        return try decode(WorkspaceSummary.self, from: json)
    }

    public func createWorkspace(name: String) async throws -> String {
        let path = dataDirPath
        return try await runFFI {
            try KobeanREST.createWorkspace(dataDir: path, name: name)
        }
    }

    public func renameWorkspace(id: String, name: String) async throws {
        let path = dataDirPath
        try await runFFI {
            try KobeanREST.renameWorkspace(dataDir: path, workspaceId: id, name: name)
        }
    }

    public func deleteWorkspace(id: String) async throws {
        let path = dataDirPath
        try await runFFI {
            try KobeanREST.deleteWorkspace(dataDir: path, workspaceId: id)
        }
    }

    // MARK: - Collection CRUD

    public func createCollection(name: String, workspaceId: String? = nil) async throws -> String {
        let path = dataDirPath
        return try await runFFI {
            try KobeanREST.createCollection(dataDir: path, name: name, workspaceId: workspaceId)
        }
    }

    public func updateCollection(id: String, name: String) async throws {
        let path = dataDirPath
        try await runFFI {
            try KobeanREST.updateCollection(dataDir: path, collectionId: id, name: name)
        }
    }

    public func deleteCollection(id: String) async throws {
        let path = dataDirPath
        try await runFFI {
            try KobeanREST.deleteCollection(dataDir: path, collectionId: id)
        }
    }

    public func saveCollectionAuth(id: String, authMode: String, authConfig: AuthConfig) async throws {
        let path = dataDirPath
        let authConfigJson = authConfig.encodeJson()
        try await runFFI {
            try KobeanREST.saveCollectionAuth(
                dataDir: path,
                collectionId: id,
                authMode: authMode,
                authConfigJson: authConfigJson
            )
        }
    }

    // MARK: - Folder CRUD

    public func createFolder(
        name: String,
        collectionId: String? = nil,
        parentId: String? = nil
    ) async throws -> FolderSummary {
        let path = dataDirPath
        let json = try await runFFI {
            try KobeanREST.createFolder(
                dataDir: path,
                name: name,
                collectionId: collectionId,
                parentId: parentId
            )
        }
        return try decode(FolderSummary.self, from: json)
    }

    public func updateFolder(id: String, name: String) async throws {
        let path = dataDirPath
        try await runFFI {
            try KobeanREST.updateFolder(dataDir: path, folderId: id, name: name)
        }
    }

    public func deleteFolder(id: String) async throws {
        let path = dataDirPath
        try await runFFI {
            try KobeanREST.deleteFolder(dataDir: path, folderId: id)
        }
    }

    public func saveFolderAuth(id: String, authMode: String, authConfig: AuthConfig) async throws {
        let path = dataDirPath
        let authConfigJson = authConfig.encodeJson()
        try await runFFI {
            try KobeanREST.saveFolderAuth(
                dataDir: path,
                folderId: id,
                authMode: authMode,
                authConfigJson: authConfigJson
            )
        }
    }

    // MARK: - Request CRUD

    public func createRequest(folderId: String) async throws -> SavedRequest {
        let path = dataDirPath
        let json = try await runFFI {
            try KobeanREST.createRequest(dataDir: path, folderId: folderId)
        }
        return try decode(SavedRequest.self, from: json)
    }

    public func saveRequest(_ request: SavedRequest) async throws {
        let path = dataDirPath
        let requestJson = try encode(request)
        try await runFFI {
            try KobeanREST.saveRequestJson(dataDir: path, requestJson: requestJson)
        }
    }

    public func deleteRequest(id: String) async throws {
        let path = dataDirPath
        try await runFFI {
            try KobeanREST.deleteRequest(dataDir: path, requestId: id)
        }
    }

    // MARK: - Environment & Keychain Secret CRUD

    public func createEnvironment(name: String) async throws -> EnvironmentSummary {
        let path = dataDirPath
        let json = try await runFFI {
            try KobeanREST.createEnvironment(dataDir: path, name: name)
        }
        return try decode(EnvironmentSummary.self, from: json)
    }

    public func renameEnvironment(oldName: String, newName: String) async throws {
        let path = dataDirPath
        try await runFFI {
            try KobeanREST.renameEnvironment(dataDir: path, oldName: oldName, newName: newName)
        }
    }

    public func deleteEnvironment(name: String) async throws {
        let path = dataDirPath
        try await runFFI {
            try KobeanREST.deleteEnvironment(dataDir: path, name: name)
        }
    }

    public func setActiveEnvironment(name: String) async throws {
        let path = dataDirPath
        try await runFFI {
            try KobeanREST.setActiveEnvironment(dataDir: path, name: name)
        }
    }

    public func saveVariable(
        environmentName: String,
        key: String,
        value: String,
        masked: Bool? = nil
    ) async throws {
        let path = dataDirPath
        try await runFFI {
            try KobeanREST.saveVariable(
                dataDir: path,
                environmentName: environmentName,
                key: key,
                value: value,
                masked: masked
            )
        }
    }

    public func saveSecretVariable(
        environmentName: String,
        key: String,
        value: String,
        scope: String
    ) async throws -> String {
        let path = dataDirPath
        return try await runFFI {
            let refId = try KobeanREST.storeSecret(scope: scope, key: key, value: value)
            try KobeanREST.saveSecretVariable(
                dataDir: path,
                environmentName: environmentName,
                key: key,
                secretRef: refId
            )
            return refId
        }
    }

    public func deleteVariable(
        environmentName: String,
        key: String,
        secretRef: String? = nil
    ) async throws {
        let path = dataDirPath
        try await runFFI {
            try KobeanREST.deleteVariable(dataDir: path, environmentName: environmentName, key: key)
            if let refId = secretRef, !refId.isEmpty {
                try? KobeanREST.deleteSecret(refId: refId)
            }
        }
    }

    public func storeSecret(scope: String, key: String, value: String) async throws -> String {
        try await runFFI {
            try KobeanREST.storeSecret(scope: scope, key: key, value: value)
        }
    }

    public func resolveSecrets(refIds: [String]) async throws -> [String: String] {
        guard !refIds.isEmpty else { return [:] }
        return try await runFFI {
            try KobeanREST.resolveSecrets(refIds: refIds)
        }
    }

    public func deleteSecret(refId: String) async throws {
        try await runFFI {
            try KobeanREST.deleteSecret(refId: refId)
        }
    }

    /// Resolves Keychain-backed secret variables for the active environment into an ephemeral in-memory map.
    /// Plaintext values are never persisted back to SQLite.
    public func resolveEnvironmentSecretValues(workspace: WorkspaceSummary) async -> [String: String] {
        guard !workspace.activeEnvironment.isEmpty,
              let env = workspace.environments.first(where: { $0.name == workspace.activeEnvironment }) else {
            return [:]
        }
        let secretEntries = env.variables.compactMap { variable -> (key: String, refId: String)? in
            guard let ref = variable.secretRef, !ref.isEmpty, !variable.key.isEmpty else { return nil }
            return (variable.key, ref)
        }
        let refIds = Array(Set(secretEntries.map(\.refId)))
        guard !refIds.isEmpty, let resolved = try? await resolveSecrets(refIds: refIds) else {
            return [:]
        }
        var result: [String: String] = [:]
        for entry in secretEntries {
            if let value = resolved[entry.refId], !value.isEmpty {
                result[entry.key] = value
            }
        }
        return result
    }

    public func buildScopedVariableMap(
        request: SavedRequest,
        workspace: WorkspaceSummary
    ) async throws -> [String: String] {
        let requestJson = try encode(request)
        let workspaceJson = try encode(workspace)
        let baseVarMapJson = try await runFFI {
            try buildScopedVariableMapJson(
                workspaceJson: workspaceJson,
                collectionId: nil,
                folderId: request.folderId.isEmpty ? nil : request.folderId,
                requestId: request.id,
                requestJson: requestJson
            )
        }
        return try decode([String: String].self, from: baseVarMapJson)
    }

    // MARK: - Scripts CRUD

    public func getScripts(entityId: String, entityType: String) async throws -> [ScriptRecord] {
        let path = dataDirPath
        let json = try await runFFI {
            try getScriptsJson(dataDir: path, entityId: entityId, entityType: entityType)
        }
        return try decode([ScriptRecord].self, from: json)
    }

    public func getAllScripts() async throws -> [ScriptRecord] {
        let path = dataDirPath
        let json = try await runFFI {
            try getAllScriptsJson(dataDir: path)
        }
        return try decode([ScriptRecord].self, from: json)
    }

    public func saveScript(
        entityId: String,
        entityType: String,
        scriptType: String,
        content: String
    ) async throws {
        let path = dataDirPath
        try await runFFI {
            try KobeanREST.saveScript(
                dataDir: path,
                entityId: entityId,
                entityType: entityType,
                scriptType: scriptType,
                content: content
            )
        }
    }

    public func deleteScript(scriptId: String) async throws {
        let path = dataDirPath
        try await runFFI {
            try KobeanREST.deleteScript(dataDir: path, scriptId: scriptId)
        }
    }

    // MARK: - Prepare & Execute HTTP Request

    public nonisolated static let secretReferencePrefix = "kobeanrest://secrets/"
    private nonisolated static let authSecretJsonKeys = [
        "token",
        "refreshToken",
        "clientSecret",
        "password",
        "keyValue",
        "accessToken",
    ]
    private nonisolated static let sensitiveHistoryHeaderNames: Set<String> = [
        "authorization",
        "proxy-authorization",
        "cookie",
        "set-cookie",
        "x-api-key",
        "api-key",
        "x-auth-token",
        "x-access-token",
        "x-refresh-token",
        "x-csrf-token",
        "x-xsrf-token",
        "x-amz-security-token",
        "x-secret-key",
        "x-client-secret",
        "client-secret",
    ]
    private nonisolated static let sensitiveQueryParamNames: Set<String> = [
        "token",
        "access_token",
        "api_key",
        "apikey",
        "client_secret",
        "secret",
        "password",
        "code",
    ]

    public func prepareAndExecuteRequest(
        request: SavedRequest,
        workspace: WorkspaceSummary,
        variableOverrides: [String: String] = [:],
        customMethod: String? = nil
    ) async throws -> PreparedExecutionResult {
        let (resolvedRequest, resolvedWorkspace) = try await resolveAuthSecretsInMemory(
            request: request,
            workspace: workspace
        )
        let requestJson = try encode(resolvedRequest)
        let workspaceJson = try encode(resolvedWorkspace)

        let baseVarMapJson = try await runFFI {
            try buildScopedVariableMapJson(
                workspaceJson: workspaceJson,
                collectionId: nil,
                folderId: resolvedRequest.folderId.isEmpty ? nil : resolvedRequest.folderId,
                requestId: resolvedRequest.id,
                requestJson: requestJson
            )
        }
        var variableMap = try decode([String: String].self, from: baseVarMapJson)

        // Resolve Keychain-backed secret variables in precedence order without ever persisting them to SQLite.
        let secretEntries = collectSecretVariableEntries(request: resolvedRequest, workspace: resolvedWorkspace)
        let refIds = Array(Set(secretEntries.map(\.refId)))
        if !refIds.isEmpty {
            let resolvedSecrets = try await resolveSecrets(refIds: refIds)
            for entry in secretEntries {
                if let resolved = resolvedSecrets[entry.refId], !resolved.isEmpty {
                    variableMap[entry.key] = resolved
                }
            }
        }

        for (key, value) in variableOverrides {
            variableMap[key] = value
        }

        let mergedVarMapJson = try encode(variableMap)
        let preparedJson = try await runFFI {
            try prepareHttpRequestJson(
                requestJson: requestJson,
                workspaceJson: workspaceJson,
                variableMapJson: mergedVarMapJson,
                customMethod: customMethod
            )
        }
        let prepared = try decode(PreparedHttpRequest.self, from: preparedJson)

        let executePayload = prepared.toExecuteHttpRequest()
        let executeJson = try encode(executePayload)

        let responseJson = try await runFFI {
            try executeHttpRequestJson(requestJson: executeJson)
        }
        let response = try decode(ExecuteHttpResponse.self, from: responseJson)

        logger.info(
            "Executed \(prepared.method, privacy: .public) status=\(response.status, privacy: .public) durationMs=\(response.durationMs, privacy: .public) url=\(prepared.historyUrl, privacy: .private)"
        )

        return PreparedExecutionResult(prepared: prepared, response: response)
    }

    private func resolveAuthSecretsInMemory(
        request: SavedRequest,
        workspace: WorkspaceSummary
    ) async throws -> (SavedRequest, WorkspaceSummary) {
        var refs = Self.collectAuthSecretRefs(from: request.authConfig)

        var effectiveFolderIndex: Int?
        var effectiveCollectionIndex: Int?
        let normalizedMode = request.authMode.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if normalizedMode.isEmpty || normalizedMode == "none" {
            let target = Self.findEffectiveInheritedAuthTarget(request: request, workspace: workspace)
            effectiveFolderIndex = target.folderIndex
            effectiveCollectionIndex = target.collectionIndex
            if let fIdx = effectiveFolderIndex, let folderAuth = workspace.folders[fIdx].authConfig {
                refs.append(contentsOf: Self.collectAuthSecretRefs(from: folderAuth))
            } else if let cIdx = effectiveCollectionIndex, let colAuth = workspace.collections?[cIdx].authConfig {
                refs.append(contentsOf: Self.collectAuthSecretRefs(from: colAuth))
            }
        }

        let uniqueRefs = Array(Set(refs))
        guard !uniqueRefs.isEmpty else {
            return (request, workspace)
        }

        let resolved = try await resolveSecrets(refIds: uniqueRefs)
        for refId in uniqueRefs {
            guard let secretValue = resolved[refId], !secretValue.isEmpty else {
                throw CoreBridgeError.missingSecret(
                    "Missing or empty Keychain secret for reference '\(refId)'."
                )
            }
        }

        var updatedRequest = request
        updatedRequest.authConfig = Self.replacingAuthSecretRefs(in: request.authConfig, resolved: resolved)

        var updatedWorkspace = workspace
        if let fIdx = effectiveFolderIndex, let folderAuth = updatedWorkspace.folders[fIdx].authConfig {
            updatedWorkspace.folders[fIdx].authConfig = Self.replacingAuthSecretRefs(
                in: folderAuth,
                resolved: resolved
            )
        } else if let cIdx = effectiveCollectionIndex,
                  var collections = updatedWorkspace.collections,
                  let colAuth = collections[cIdx].authConfig {
            collections[cIdx].authConfig = Self.replacingAuthSecretRefs(
                in: colAuth,
                resolved: resolved
            )
            updatedWorkspace.collections = collections
        }

        return (updatedRequest, updatedWorkspace)
    }

    private nonisolated static func findEffectiveInheritedAuthTarget(
        request: SavedRequest,
        workspace: WorkspaceSummary
    ) -> (folderIndex: Int?, collectionIndex: Int?) {
        var visited = Set<String>()
        var currentFolderId: String? = request.folderId.isEmpty ? nil : request.folderId
        var collectionId: String?

        while let fid = currentFolderId, !fid.isEmpty, visited.insert(fid).inserted {
            if let fIdx = workspace.folders.firstIndex(where: { $0.id == fid }) {
                let folder = workspace.folders[fIdx]
                if let mode = folder.authMode?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
                   !mode.isEmpty,
                   mode != "none" {
                    return (fIdx, nil)
                }
                if collectionId == nil {
                    collectionId = folder.collectionId
                }
                currentFolderId = folder.parentId
            } else {
                if collectionId == nil,
                   workspace.collections?.contains(where: { $0.id == fid }) == true {
                    collectionId = fid
                }
                break
            }
        }

        if let cid = collectionId,
           let cIdx = workspace.collections?.firstIndex(where: { $0.id == cid }),
           let mode = workspace.collections?[cIdx].authMode?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
           !mode.isEmpty,
           mode != "none" {
            return (nil, cIdx)
        }

        return (nil, nil)
    }

    private nonisolated static func collectAuthSecretRefs(from authConfigJson: String) -> [String] {
        let trimmed = authConfigJson.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              let data = trimmed.data(using: .utf8),
              let dict = (try? JSONSerialization.jsonObject(with: data, options: [])) as? [String: Any] else {
            return []
        }

        var refs: [String] = []
        for key in authSecretJsonKeys {
            if let value = dict[key] as? String, value.hasPrefix(secretReferencePrefix) {
                refs.append(value)
            }
        }
        return refs
    }

    private nonisolated static func replacingAuthSecretRefs(
        in authConfigJson: String,
        resolved: [String: String]
    ) -> String {
        let trimmed = authConfigJson.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              let data = trimmed.data(using: .utf8),
              var dict = (try? JSONSerialization.jsonObject(with: data, options: [])) as? [String: Any] else {
            return authConfigJson
        }

        var changed = false
        for key in authSecretJsonKeys {
            if let refId = dict[key] as? String,
               refId.hasPrefix(secretReferencePrefix),
               let secretValue = resolved[refId] {
                dict[key] = secretValue
                if key == "accessToken", (dict["token"] as? String)?.isEmpty != false {
                    dict["token"] = secretValue
                }
                changed = true
            }
        }

        guard changed,
              let outData = try? JSONSerialization.data(withJSONObject: dict, options: [.sortedKeys]),
              let outString = String(data: outData, encoding: .utf8) else {
            return authConfigJson
        }
        return outString
    }

    private func collectSecretVariableEntries(
        request: SavedRequest,
        workspace: WorkspaceSummary
    ) -> [(key: String, refId: String)] {
        var ordered: [(key: String, refId: String)] = []

        if !workspace.activeEnvironment.isEmpty,
           let env = workspace.environments.first(where: { $0.name == workspace.activeEnvironment }) {
            for v in env.variables {
                if let ref = v.secretRef, !ref.isEmpty, !v.key.isEmpty {
                    ordered.append((v.key, ref))
                }
            }
        }

        var folderChain: [FolderSummary] = []
        var visited = Set<String>()
        var currentFolderId: String? = request.folderId.isEmpty ? nil : request.folderId
        var collectionId: String?

        while let fid = currentFolderId, !fid.isEmpty, visited.insert(fid).inserted {
            if let folder = workspace.folders.first(where: { $0.id == fid }) {
                folderChain.append(folder)
                if collectionId == nil {
                    collectionId = folder.collectionId
                }
                currentFolderId = folder.parentId
            } else {
                if collectionId == nil,
                   workspace.collections?.contains(where: { $0.id == fid }) == true {
                    collectionId = fid
                }
                break
            }
        }

        if let cid = collectionId,
           let collection = workspace.collections?.first(where: { $0.id == cid }),
           let vars = collection.variables {
            for v in vars {
                if let ref = v.secretRef, !ref.isEmpty, !v.key.isEmpty {
                    ordered.append((v.key, ref))
                }
            }
        }

        for folder in folderChain.reversed() {
            if let vars = folder.variables {
                for v in vars {
                    if let ref = v.secretRef, !ref.isEmpty, !v.key.isEmpty {
                        ordered.append((v.key, ref))
                    }
                }
            }
        }

        if let reqVars = request.variables {
            for v in reqVars {
                if let ref = v.secretRef, !ref.isEmpty, !v.key.isEmpty {
                    ordered.append((v.key, ref))
                }
            }
        }

        return ordered
    }

    // MARK: - History

    public func loadRequestHistory() async throws -> [HistoryEntry] {
        let path = dataDirPath
        let json = try await runFFI {
            try loadRequestHistoryJson(dataDir: path)
        }
        return try decode([HistoryEntry].self, from: json)
    }

    public func loadHistoryResponse(id: Int64) async throws -> HistoryResponsePayload {
        let path = dataDirPath
        let json = try await runFFI {
            try loadHistoryResponseJson(dataDir: path, id: id)
        }
        return try decode(HistoryResponsePayload.self, from: json)
    }

    public func recordRequestHistory(_ entry: RequestHistoryEntry) async throws {
        let path = dataDirPath
        var sanitizedEntry = entry
        sanitizedEntry.url = Self.sanitizeHistoryURL(entry.url)
        if let rawHeaders = entry.responseHeaders,
           let data = rawHeaders.data(using: .utf8),
           let decoded = try? decoder.decode([HeaderEntry].self, from: data) {
            let cleaned = Self.sanitizeHeadersForHistory(decoded)
            sanitizedEntry.responseHeaders = try? encode(cleaned)
        }
        let entryJson = try encode(sanitizedEntry)
        try await runFFI {
            try recordRequestHistoryJson(dataDir: path, entryJson: entryJson)
        }
    }

    public func clearRequestHistory() async throws {
        let path = dataDirPath
        try await runFFI {
            try KobeanREST.clearRequestHistory(dataDir: path)
        }
    }

    public func redactUrlForHistory(_ url: String, authMode: String, authConfig: AuthConfig) async throws -> String {
        let authConfigJson = authConfig.encodeJson()
        let ffiRedacted = try await runFFI {
            try redactAuthFromUrl(url: url, authMode: authMode, authConfigJson: authConfigJson)
        }
        return Self.sanitizeHistoryURL(ffiRedacted, authMode: authMode, authConfig: authConfig)
    }

    public func redactHeadersForHistory(
        _ headers: [HeaderEntry],
        authMode: String,
        authConfig: AuthConfig
    ) async throws -> [HeaderEntry] {
        let headersJson = try encode(headers)
        let authConfigJson = authConfig.encodeJson()
        let redactedJson = try await runFFI {
            try redactAuthHeadersJson(
                headersJson: headersJson,
                authMode: authMode,
                authConfigJson: authConfigJson
            )
        }
        let ffiRedacted = try decode([HeaderEntry].self, from: redactedJson)
        let apiKeyHeader = (authMode == "apiKey") ? authConfig.keyName : nil
        return Self.sanitizeHeadersForHistory(ffiRedacted, apiKeyHeaderName: apiKeyHeader)
    }

    public nonisolated static func sanitizeHeadersForHistory(
        _ headers: [HeaderEntry],
        apiKeyHeaderName: String? = nil
    ) -> [HeaderEntry] {
        let trimmedApiKeyHeader = apiKeyHeaderName?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return headers.map { header in
            let normalized = header.key.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            let matchesApiKey = trimmedApiKeyHeader.map { !$0.isEmpty && normalized == $0 } ?? false
            if sensitiveHistoryHeaderNames.contains(normalized) ||
                matchesApiKey ||
                SnippetGenerator.isSensitiveHeader(header.key) {
                var redacted = header
                redacted.value = "[redacted]"
                return redacted
            }
            return header
        }
    }

    public nonisolated static func sanitizeHistoryURL(
        _ rawURL: String,
        authMode: String = "none",
        authConfig: AuthConfig = AuthConfig()
    ) -> String {
        let apiKeyQueryName: String? = {
            guard authMode == "apiKey",
                  authConfig.placement == "query",
                  let keyName = authConfig.keyName?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !keyName.isEmpty else {
                return nil
            }
            return keyName.lowercased()
        }()

        let beforeHash: String
        let hash: String
        if let hashIdx = rawURL.firstIndex(of: "#") {
            beforeHash = String(rawURL[..<hashIdx])
            hash = String(rawURL[hashIdx...])
        } else {
            beforeHash = rawURL
            hash = ""
        }

        guard let qIdx = beforeHash.firstIndex(of: "?") else {
            return rawURL
        }
        let base = String(beforeHash[..<qIdx])
        let query = String(beforeHash[beforeHash.index(after: qIdx)...])
        guard !query.isEmpty else {
            return rawURL
        }

        var changed = false
        let sanitizedPairs = query.split(separator: "&", omittingEmptySubsequences: false).map { pairSub -> String in
            let pair = String(pairSub)
            guard let eqIdx = pair.firstIndex(of: "=") else {
                return pair
            }
            let rawKey = String(pair[..<eqIdx])
            let decodedKey = (rawKey.removingPercentEncoding ?? rawKey)
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased()
            if sensitiveQueryParamNames.contains(decodedKey) || decodedKey == apiKeyQueryName {
                changed = true
                return "\(rawKey)=[redacted]"
            }
            return pair
        }

        guard changed else { return rawURL }
        return "\(base)?\(sanitizedPairs.joined(separator: "&"))\(hash)"
    }

    // MARK: - Settings

    public func loadAppSettings() async throws -> AppSettings {
        let path = dataDirPath
        let json = try await runFFI {
            try loadAppSettingsJson(dataDir: path)
        }
        return try decode(AppSettings.self, from: json)
    }

    public func saveAppSettings(_ settings: AppSettings) async throws {
        let path = dataDirPath
        let json = try encode(settings)
        try await runFFI {
            try saveAppSettingsJson(dataDir: path, settingsJson: json)
        }
    }

    // MARK: - Path Variables & Universal Importer

    public func extractPathVariables(url: String) async -> [String] {
        await Task.detached(priority: .userInitiated) {
            KobeanREST.extractPathVariables(url: url)
        }.value
    }

    public func syncPathVariables(
        url: String,
        existing: [PathVariableEntry]?
    ) async throws -> [PathVariableEntry] {
        let existingJson: String? = try existing.map { try encode($0) }
        let json = try await runFFI {
            try syncPathVariablesJson(url: url, existingJson: existingJson)
        }
        return try decode([PathVariableEntry].self, from: json)
    }

    public func detectImportFormat(content: String) async -> String {
        await Task.detached(priority: .userInitiated) {
            KobeanREST.detectImportFormat(content: content)
        }.value
    }

    public func parseUniversalImport(
        content: String,
        defaultWorkspaceName: String? = nil
    ) async throws -> NormalizedImportResult {
        let json = try await runFFI {
            try parseUniversalImportJson(
                content: content,
                defaultWorkspaceName: defaultWorkspaceName
            )
        }

        guard let data = json.data(using: .utf8),
              let rawObj = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw CoreBridgeError.decoding("Invalid JSON payload returned by parseUniversalImportJson")
        }

        let format = rawObj["format"] as? String ?? "unknown"
        let formatLabel = rawObj["formatLabel"] as? String ?? format
        let title = rawObj["title"] as? String ?? "Imported Workspace"

        let stats: ImportStats
        if let statsObj = rawObj["stats"] {
            let statsData = try JSONSerialization.data(withJSONObject: statsObj)
            stats = try decoder.decode(ImportStats.self, from: statsData)
        } else {
            stats = ImportStats()
        }

        let exportDataJson: String
        if let exportObj = rawObj["exportData"] {
            let exportData = try JSONSerialization.data(withJSONObject: exportObj)
            guard let str = String(data: exportData, encoding: .utf8) else {
                throw CoreBridgeError.encoding("Failed to serialize imported exportData")
            }
            exportDataJson = str
        } else {
            throw CoreBridgeError.invalidData("Universal import result missing exportData")
        }

        return NormalizedImportResult(
            format: format,
            formatLabel: formatLabel,
            title: title,
            stats: stats,
            exportDataJson: exportDataJson
        )
    }

    public func parseCurlCommand(raw: String) async throws -> CurlImportResult {
        let json = try await runFFI {
            try parseCurlCommandJson(raw: raw)
        }
        return try decode(CurlImportResult.self, from: json)
    }

    public func importWorkspaceData(json: String) async throws {
        let path = dataDirPath
        try await runFFI {
            try KobeanREST.importWorkspaceData(dataDir: path, json: json)
        }
    }

    public func exportWorkspaceData() async throws -> String {
        let path = dataDirPath
        return try await runFFI {
            try KobeanREST.exportWorkspaceData(dataDir: path)
        }
    }

    // MARK: - Private Helpers

    private nonisolated func encode<T: Encodable>(_ value: T) throws -> String {
        do {
            let data = try encoder.encode(value)
            guard let json = String(data: data, encoding: .utf8) else {
                throw CoreBridgeError.encoding("UTF-8 conversion failed during JSON encoding")
            }
            return json
        } catch let bridgeError as CoreBridgeError {
            throw bridgeError
        } catch {
            throw CoreBridgeError.encoding("Failed to encode \(T.self): \(error.localizedDescription)")
        }
    }

    private nonisolated func decode<T: Decodable>(_ type: T.Type, from json: String) throws -> T {
        guard let data = json.data(using: .utf8) else {
            throw CoreBridgeError.decoding("Invalid UTF-8 JSON for \(T.self)")
        }
        do {
            return try decoder.decode(type, from: data)
        } catch {
            throw CoreBridgeError.decoding("Failed to decode \(T.self): \(error.localizedDescription)")
        }
    }

    private nonisolated func runFFI<T: Sendable>(_ work: @Sendable @escaping () throws -> T) async throws -> T {
        try await Task.detached(priority: .userInitiated) {
            do {
                return try work()
            } catch let ffiError as KobeanFfiError {
                switch ffiError {
                case .Message(let message):
                    throw CoreBridgeError.ffi(message)
                }
            } catch let bridgeError as CoreBridgeError {
                throw bridgeError
            } catch {
                throw CoreBridgeError.ffi(error.localizedDescription)
            }
        }.value
    }
}
