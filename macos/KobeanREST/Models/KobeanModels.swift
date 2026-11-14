import Foundation
import SwiftUI

// MARK: - Enums & UI State Tokens

public enum HTTPMethod: String, CaseIterable, Codable, Sendable, Identifiable, Hashable {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
    case head = "HEAD"
    case options = "OPTIONS"
    case ws = "WS"
    case custom = "CUSTOM"

    public var id: String { rawValue }

    public var color: Color {
        switch self {
        case .get: return .green
        case .post: return .orange
        case .put, .patch: return .blue
        case .delete: return .red
        case .head, .options: return .teal
        case .ws: return .purple
        case .custom: return .secondary
        }
    }

    public var shortLabel: String {
        switch self {
        case .delete: return "DEL"
        case .options: return "OPT"
        default: return rawValue
        }
    }

    public static func from(_ raw: String) -> HTTPMethod {
        HTTPMethod(rawValue: raw.uppercased()) ?? .custom
    }
}

public enum BodyMimeType: String, CaseIterable, Codable, Sendable, Identifiable, Hashable {
    case none = ""
    case json = "application/json"
    case graphql = "application/graphql"
    case text = "text/plain"
    case xml = "application/xml"
    case formUrlEncoded = "application/x-www-form-urlencoded"
    case multipartFormData = "multipart/form-data"
    case binary = "application/octet-stream"

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .none: return "None"
        case .json: return "JSON"
        case .graphql: return "GraphQL"
        case .text: return "Plain Text"
        case .xml: return "XML"
        case .formUrlEncoded: return "Form URL-Encoded"
        case .multipartFormData: return "Multipart Form"
        case .binary: return "Binary (Base64)"
        }
    }

    public static func from(_ raw: String) -> BodyMimeType {
        BodyMimeType(rawValue: raw) ?? .text
    }
}

public enum AuthMode: String, CaseIterable, Codable, Sendable, Identifiable, Hashable {
    case none
    case basic
    case bearer
    case apikey
    case oauth2

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .none: return "Inherit / None"
        case .basic: return "Basic Auth"
        case .bearer: return "Bearer Token"
        case .apikey: return "API Key"
        case .oauth2: return "OAuth 2.0"
        }
    }

    public static func from(_ raw: String) -> AuthMode {
        AuthMode(rawValue: raw.lowercased()) ?? .none
    }
}

public enum RequestInspectorTab: String, CaseIterable, Sendable, Identifiable {
    case params = "Params"
    case headers = "Headers"
    case auth = "Auth"
    case body = "Body"
    case scripts = "Scripts"

    public var id: String { rawValue }
}

public enum ResponseInspectorTab: String, CaseIterable, Sendable, Identifiable {
    case body = "Body"
    case headers = "Headers"
    case timing = "Timing"
    case tests = "Tests & Logs"

    public var id: String { rawValue }
}

public enum SidebarSection: String, CaseIterable, Sendable, Identifiable {
    case collections = "Collections"
    case history = "History"

    public var id: String { rawValue }
}

public enum SplitOrientation: String, CaseIterable, Sendable {
    case horizontal
    case vertical
}

public enum ResponseState: Sendable, Equatable {
    case idle
    case loading(startedAt: Date)
    case success(ExecuteHttpResponse)
    case error(String)
}

// MARK: - Core Persistence & Domain DTOs

public struct HeaderEntry: Codable, Sendable, Identifiable, Hashable {
    public var id: UUID
    public var key: String
    public var value: String
    public var enabled: Bool
    public var fieldType: String?

    enum CodingKeys: String, CodingKey {
        case key, value, enabled
        case fieldType = "type"
    }

    public init(
        id: UUID = UUID(),
        key: String = "",
        value: String = "",
        enabled: Bool = true,
        fieldType: String? = nil
    ) {
        self.id = id
        self.key = key
        self.value = value
        self.enabled = enabled
        self.fieldType = fieldType
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = UUID()
        self.key = try c.decodeIfPresent(String.self, forKey: .key) ?? ""
        self.value = try c.decodeIfPresent(String.self, forKey: .value) ?? ""
        self.enabled = try c.decodeIfPresent(Bool.self, forKey: .enabled) ?? true
        self.fieldType = try c.decodeIfPresent(String.self, forKey: .fieldType)
    }
}

public struct HeaderEntrySimple: Codable, Sendable, Hashable {
    public var key: String
    public var value: String

    public init(key: String, value: String) {
        self.key = key
        self.value = value
    }
}

public struct ResponseExample: Codable, Sendable, Identifiable, Hashable {
    public var id: String
    public var name: String
    public var code: Int64
    public var status: String
    public var headers: [HeaderEntrySimple]?
    public var body: String
    public var bodyMimeType: String?

    enum CodingKeys: String, CodingKey {
        case id, name, code, status, headers, body, bodyMimeType
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        self.name = try c.decodeIfPresent(String.self, forKey: .name) ?? "Example"
        self.code = try c.decodeIfPresent(Int64.self, forKey: .code) ?? 200
        self.status = try c.decodeIfPresent(String.self, forKey: .status) ?? "OK"
        self.headers = try c.decodeIfPresent([HeaderEntrySimple].self, forKey: .headers)
        self.body = try c.decodeIfPresent(String.self, forKey: .body) ?? ""
        self.bodyMimeType = try c.decodeIfPresent(String.self, forKey: .bodyMimeType)
    }
}

public struct PathVariableEntry: Codable, Sendable, Identifiable, Hashable {
    public var id: UUID
    public var key: String
    public var value: String
    public var enabled: Bool
    public var description: String?

    enum CodingKeys: String, CodingKey {
        case key, value, enabled, description
    }

    public init(
        id: UUID = UUID(),
        key: String,
        value: String = "",
        enabled: Bool = true,
        description: String? = nil
    ) {
        self.id = id
        self.key = key
        self.value = value
        self.enabled = enabled
        self.description = description
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = UUID()
        self.key = try c.decodeIfPresent(String.self, forKey: .key) ?? ""
        self.value = try c.decodeIfPresent(String.self, forKey: .value) ?? ""
        self.enabled = try c.decodeIfPresent(Bool.self, forKey: .enabled) ?? true
        self.description = try c.decodeIfPresent(String.self, forKey: .description)
    }
}

public struct ScopedVariable: Codable, Sendable, Identifiable, Hashable {
    public var id: UUID
    public var key: String
    public var value: String
    public var secret: Bool
    public var secretRef: String?

    enum CodingKeys: String, CodingKey {
        case key, value, secret, secretRef
    }

    public init(
        id: UUID = UUID(),
        key: String = "",
        value: String = "",
        secret: Bool = false,
        secretRef: String? = nil
    ) {
        self.id = id
        self.key = key
        self.value = value
        self.secret = secret
        self.secretRef = secretRef
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = UUID()
        self.key = try c.decodeIfPresent(String.self, forKey: .key) ?? ""
        self.value = try c.decodeIfPresent(String.self, forKey: .value) ?? ""
        self.secret = try c.decodeIfPresent(Bool.self, forKey: .secret) ?? false
        self.secretRef = try c.decodeIfPresent(String.self, forKey: .secretRef)
    }
}

public struct AuthConfig: Codable, Sendable, Hashable {
    public var username: String?
    public var password: String?
    public var token: String?
    public var keyName: String?
    public var keyValue: String?
    public var placement: String?
    public var grantType: String?
    public var authUrl: String?
    public var accessTokenUrl: String?
    public var clientId: String?
    public var clientSecret: String?
    public var scope: String?
    public var audience: String?
    public var refreshToken: String?
    public var expiresAt: Int64?
    public var redirectUri: String?

    public init(
        username: String? = nil,
        password: String? = nil,
        token: String? = nil,
        keyName: String? = nil,
        keyValue: String? = nil,
        placement: String? = nil,
        grantType: String? = nil,
        authUrl: String? = nil,
        accessTokenUrl: String? = nil,
        clientId: String? = nil,
        clientSecret: String? = nil,
        scope: String? = nil,
        audience: String? = nil,
        refreshToken: String? = nil,
        expiresAt: Int64? = nil,
        redirectUri: String? = nil
    ) {
        self.username = username
        self.password = password
        self.token = token
        self.keyName = keyName
        self.keyValue = keyValue
        self.placement = placement
        self.grantType = grantType
        self.authUrl = authUrl
        self.accessTokenUrl = accessTokenUrl
        self.clientId = clientId
        self.clientSecret = clientSecret
        self.scope = scope
        self.audience = audience
        self.refreshToken = refreshToken
        self.expiresAt = expiresAt
        self.redirectUri = redirectUri
    }

    public static func decode(from json: String) -> AuthConfig {
        guard let data = json.data(using: .utf8), !json.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return AuthConfig()
        }
        return (try? JSONDecoder().decode(AuthConfig.self, from: data)) ?? AuthConfig()
    }

    public func encodeJson() -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        guard let data = try? encoder.encode(self), let str = String(data: data, encoding: .utf8) else {
            return "{}"
        }
        return str
    }
}

public struct EffectiveAuth: Codable, Sendable, Hashable {
    public var mode: String
    public var config: AuthConfig
    public var source: String
    public var entityId: String?
    public var entityType: String?

    public init(
        mode: String = "none",
        config: AuthConfig = AuthConfig(),
        source: String = "No inherited auth",
        entityId: String? = nil,
        entityType: String? = nil
    ) {
        self.mode = mode
        self.config = config
        self.source = source
        self.entityId = entityId
        self.entityType = entityType
    }
}

public struct SavedRequest: Codable, Sendable, Identifiable, Hashable {
    public var id: String
    public var name: String
    public var method: String
    public var url: String
    public var folderId: String
    public var authMode: String
    public var authConfig: String
    public var headers: [HeaderEntry]
    public var queryParams: String
    public var body: String
    public var bodyMimeType: String
    public var bodyForm: String
    public var timeoutMs: Int64
    public var followRedirects: Bool
    public var variables: [ScopedVariable]?
    public var description: String?
    public var examples: [ResponseExample]?
    public var pathVariables: [PathVariableEntry]?

    enum CodingKeys: String, CodingKey {
        case id, name, method, url, folderId, authMode, authConfig
        case headers, queryParams, body, bodyMimeType, bodyForm
        case timeoutMs, followRedirects, variables, description
        case examples, pathVariables
    }

    public init(
        id: String,
        name: String,
        method: String = "GET",
        url: String = "",
        folderId: String = "",
        authMode: String = "none",
        authConfig: String = "{}",
        headers: [HeaderEntry] = [],
        queryParams: String = "[]",
        body: String = "",
        bodyMimeType: String = "text/plain",
        bodyForm: String = "[]",
        timeoutMs: Int64 = 30000,
        followRedirects: Bool = true,
        variables: [ScopedVariable]? = nil,
        description: String? = nil,
        examples: [ResponseExample]? = nil,
        pathVariables: [PathVariableEntry]? = nil
    ) {
        self.id = id
        self.name = name
        self.method = method
        self.url = url
        self.folderId = folderId
        self.authMode = authMode
        self.authConfig = authConfig
        self.headers = headers
        self.queryParams = queryParams
        self.body = body
        self.bodyMimeType = bodyMimeType
        self.bodyForm = bodyForm
        self.timeoutMs = timeoutMs
        self.followRedirects = followRedirects
        self.variables = variables
        self.description = description
        self.examples = examples
        self.pathVariables = pathVariables
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try c.decode(String.self, forKey: .id)
        self.name = try c.decodeIfPresent(String.self, forKey: .name) ?? "Untitled Request"
        self.method = try c.decodeIfPresent(String.self, forKey: .method) ?? "GET"
        self.url = try c.decodeIfPresent(String.self, forKey: .url) ?? ""
        self.folderId = try c.decodeIfPresent(String.self, forKey: .folderId) ?? ""
        self.authMode = try c.decodeIfPresent(String.self, forKey: .authMode) ?? "none"
        self.authConfig = try c.decodeIfPresent(String.self, forKey: .authConfig) ?? "{}"
        self.headers = try c.decodeIfPresent([HeaderEntry].self, forKey: .headers) ?? []
        self.queryParams = try c.decodeIfPresent(String.self, forKey: .queryParams) ?? "[]"
        self.body = try c.decodeIfPresent(String.self, forKey: .body) ?? ""
        self.bodyMimeType = try c.decodeIfPresent(String.self, forKey: .bodyMimeType) ?? "text/plain"
        self.bodyForm = try c.decodeIfPresent(String.self, forKey: .bodyForm) ?? "[]"
        self.timeoutMs = try c.decodeIfPresent(Int64.self, forKey: .timeoutMs) ?? 30000
        self.followRedirects = try c.decodeIfPresent(Bool.self, forKey: .followRedirects) ?? true
        self.variables = try c.decodeIfPresent([ScopedVariable].self, forKey: .variables)
        self.description = try c.decodeIfPresent(String.self, forKey: .description)
        self.examples = try c.decodeIfPresent([ResponseExample].self, forKey: .examples)
        self.pathVariables = try c.decodeIfPresent([PathVariableEntry].self, forKey: .pathVariables)
    }

    public static func draft(folderID: String = "") -> SavedRequest {
        SavedRequest(
            id: "draft-\(UUID().uuidString)",
            name: "New Request",
            method: "GET",
            url: "",
            folderId: folderID
        )
    }

    public var decodedQueryParams: [HeaderEntry] {
        guard let data = queryParams.data(using: .utf8) else { return [] }
        return (try? JSONDecoder().decode([HeaderEntry].self, from: data)) ?? []
    }

    public mutating func setQueryParams(_ entries: [HeaderEntry]) {
        guard let data = try? JSONEncoder().encode(entries),
              let json = String(data: data, encoding: .utf8) else {
            return
        }
        self.queryParams = json
    }

    public var decodedBodyForm: [HeaderEntry] {
        guard let data = bodyForm.data(using: .utf8) else { return [] }
        return (try? JSONDecoder().decode([HeaderEntry].self, from: data)) ?? []
    }

    public mutating func setBodyForm(_ entries: [HeaderEntry]) {
        guard let data = try? JSONEncoder().encode(entries),
              let json = String(data: data, encoding: .utf8) else {
            return
        }
        self.bodyForm = json
    }

    public var decodedAuthConfig: AuthConfig {
        AuthConfig.decode(from: authConfig)
    }

    public mutating func setAuthConfig(_ config: AuthConfig) {
        self.authConfig = config.encodeJson()
    }
}

public struct EnvironmentVariable: Codable, Sendable, Identifiable, Hashable {
    public var id: UUID
    public var key: String
    public var value: String
    public var secret: Bool
    public var secretRef: String?
    public var masked: Bool

    public static let redactedPlaceholder = "[secret stored outside SQLite]"

    enum CodingKeys: String, CodingKey {
        case key, value, secret, secretRef, masked
    }

    public init(
        id: UUID = UUID(),
        key: String,
        value: String = "",
        secret: Bool = false,
        secretRef: String? = nil,
        masked: Bool = false
    ) {
        self.id = id
        self.key = key
        self.value = value
        self.secret = secret
        self.secretRef = secretRef
        self.masked = masked
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = UUID()
        self.key = try c.decodeIfPresent(String.self, forKey: .key) ?? ""
        self.value = try c.decodeIfPresent(String.self, forKey: .value) ?? ""
        self.secret = try c.decodeIfPresent(Bool.self, forKey: .secret) ?? false
        self.secretRef = try c.decodeIfPresent(String.self, forKey: .secretRef)
        self.masked = try c.decodeIfPresent(Bool.self, forKey: .masked) ?? false
    }
}

public struct EnvironmentSummary: Codable, Sendable, Identifiable, Hashable {
    public var id: String { name }
    public var name: String
    public var variables: [EnvironmentVariable]

    enum CodingKeys: String, CodingKey {
        case name, variables
    }

    public init(name: String, variables: [EnvironmentVariable] = []) {
        self.name = name
        self.variables = variables
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.name = try c.decode(String.self, forKey: .name)
        self.variables = try c.decodeIfPresent([EnvironmentVariable].self, forKey: .variables) ?? []
    }
}

public struct FolderSummary: Codable, Sendable, Identifiable, Hashable {
    public var id: String
    public var name: String
    public var authMode: String?
    public var authConfig: String?
    public var collectionId: String?
    public var parentId: String?
    public var variables: [ScopedVariable]?
    public var description: String?

    enum CodingKeys: String, CodingKey {
        case id, name, authMode, authConfig, collectionId, parentId, variables, description
    }

    public init(
        id: String,
        name: String,
        authMode: String? = nil,
        authConfig: String? = nil,
        collectionId: String? = nil,
        parentId: String? = nil,
        variables: [ScopedVariable]? = nil,
        description: String? = nil
    ) {
        self.id = id
        self.name = name
        self.authMode = authMode
        self.authConfig = authConfig
        self.collectionId = collectionId
        self.parentId = parentId
        self.variables = variables
        self.description = description
    }
}

public struct CollectionSummary: Codable, Sendable, Identifiable, Hashable {
    public var id: String
    public var name: String
    public var authMode: String?
    public var authConfig: String?
    public var variables: [ScopedVariable]?
    public var defaultEnvironment: String?
    public var description: String?

    enum CodingKeys: String, CodingKey {
        case id, name, authMode, authConfig, variables, defaultEnvironment, description
    }

    public init(
        id: String,
        name: String,
        authMode: String? = nil,
        authConfig: String? = nil,
        variables: [ScopedVariable]? = nil,
        defaultEnvironment: String? = nil,
        description: String? = nil
    ) {
        self.id = id
        self.name = name
        self.authMode = authMode
        self.authConfig = authConfig
        self.variables = variables
        self.defaultEnvironment = defaultEnvironment
        self.description = description
    }
}

public struct WorkspaceListItem: Codable, Sendable, Identifiable, Hashable {
    public var id: String
    public var name: String

    public init(id: String, name: String) {
        self.id = id
        self.name = name
    }
}

public struct WorkspaceSummary: Codable, Sendable, Identifiable, Hashable {
    public var id: String
    public var name: String
    public var activeEnvironment: String
    public var environments: [EnvironmentSummary]
    public var folders: [FolderSummary]
    public var requests: [SavedRequest]
    public var collections: [CollectionSummary]?

    enum CodingKeys: String, CodingKey {
        case id, name, activeEnvironment, environments, folders, requests, collections
    }

    public init(
        id: String,
        name: String,
        activeEnvironment: String = "",
        environments: [EnvironmentSummary] = [],
        folders: [FolderSummary] = [],
        requests: [SavedRequest] = [],
        collections: [CollectionSummary]? = []
    ) {
        self.id = id
        self.name = name
        self.activeEnvironment = activeEnvironment
        self.environments = environments
        self.folders = folders
        self.requests = requests
        self.collections = collections
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try c.decode(String.self, forKey: .id)
        self.name = try c.decodeIfPresent(String.self, forKey: .name) ?? "Workspace"
        self.activeEnvironment = try c.decodeIfPresent(String.self, forKey: .activeEnvironment) ?? ""
        self.environments = try c.decodeIfPresent([EnvironmentSummary].self, forKey: .environments) ?? []
        self.folders = try c.decodeIfPresent([FolderSummary].self, forKey: .folders) ?? []
        self.requests = try c.decodeIfPresent([SavedRequest].self, forKey: .requests) ?? []
        self.collections = try c.decodeIfPresent([CollectionSummary].self, forKey: .collections)
    }
}

// MARK: - Settings & History DTOs

public struct AppSettings: Codable, Sendable, Equatable {
    public var updateChecksEnabled: Bool
    public var theme: String
    public var exportRedactionEnabled: Bool
    public var diagnosticsRedactionEnabled: Bool
    public var offlineBehavior: String
    public var responseAutoWrap: Bool?
    public var responseAutoCollapse: Bool?
    public var language: String?
    public var quotesEnabled: Bool?

    enum CodingKeys: String, CodingKey {
        case updateChecksEnabled, theme, exportRedactionEnabled
        case diagnosticsRedactionEnabled, offlineBehavior
        case responseAutoWrap, responseAutoCollapse, language, quotesEnabled
    }

    public static let `default` = AppSettings(
        updateChecksEnabled: false,
        theme: "system",
        exportRedactionEnabled: true,
        diagnosticsRedactionEnabled: true,
        offlineBehavior: "local-only",
        responseAutoWrap: true,
        responseAutoCollapse: false,
        language: "en",
        quotesEnabled: false
    )

    public init(
        updateChecksEnabled: Bool = false,
        theme: String = "system",
        exportRedactionEnabled: Bool = true,
        diagnosticsRedactionEnabled: Bool = true,
        offlineBehavior: String = "local-only",
        responseAutoWrap: Bool? = true,
        responseAutoCollapse: Bool? = false,
        language: String? = "en",
        quotesEnabled: Bool? = false
    ) {
        self.updateChecksEnabled = updateChecksEnabled
        self.theme = theme
        self.exportRedactionEnabled = exportRedactionEnabled
        self.diagnosticsRedactionEnabled = diagnosticsRedactionEnabled
        self.offlineBehavior = offlineBehavior
        self.responseAutoWrap = responseAutoWrap
        self.responseAutoCollapse = responseAutoCollapse
        self.language = language
        self.quotesEnabled = quotesEnabled
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.updateChecksEnabled = try c.decodeIfPresent(Bool.self, forKey: .updateChecksEnabled) ?? false
        self.theme = try c.decodeIfPresent(String.self, forKey: .theme) ?? "system"
        self.exportRedactionEnabled = try c.decodeIfPresent(Bool.self, forKey: .exportRedactionEnabled) ?? true
        self.diagnosticsRedactionEnabled = try c.decodeIfPresent(Bool.self, forKey: .diagnosticsRedactionEnabled) ?? true
        self.offlineBehavior = try c.decodeIfPresent(String.self, forKey: .offlineBehavior) ?? "local-only"
        self.responseAutoWrap = try c.decodeIfPresent(Bool.self, forKey: .responseAutoWrap)
        self.responseAutoCollapse = try c.decodeIfPresent(Bool.self, forKey: .responseAutoCollapse)
        self.language = try c.decodeIfPresent(String.self, forKey: .language)
        self.quotesEnabled = try c.decodeIfPresent(Bool.self, forKey: .quotesEnabled)
    }
}

public struct HistoryEntry: Codable, Sendable, Identifiable, Hashable {
    public var id: Int64
    public var requestId: String
    public var method: String
    public var url: String
    public var status: Int64
    public var durationMs: Int64
    public var sizeBytes: Int64
    public var createdAt: String
    public var runId: String?
    public var scopeId: String?
    public var scopeName: String?
    public var testPassed: Bool?
    public var passedTests: Int64?
    public var failedTests: Int64?
    public var testResults: String?
    public var responseHeaders: String?
    public var responseBodyText: String?
    public var responseBodyBase64: String?

    enum CodingKeys: String, CodingKey {
        case id, requestId, method, url, status, durationMs, sizeBytes, createdAt
        case runId, scopeId, scopeName, testPassed, passedTests, failedTests, testResults
        case responseHeaders, responseBodyText, responseBodyBase64
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try c.decode(Int64.self, forKey: .id)
        self.requestId = try c.decodeIfPresent(String.self, forKey: .requestId) ?? ""
        self.method = try c.decodeIfPresent(String.self, forKey: .method) ?? "GET"
        self.url = try c.decodeIfPresent(String.self, forKey: .url) ?? ""
        self.status = try c.decodeIfPresent(Int64.self, forKey: .status) ?? 0
        self.durationMs = try c.decodeIfPresent(Int64.self, forKey: .durationMs) ?? 0
        self.sizeBytes = try c.decodeIfPresent(Int64.self, forKey: .sizeBytes) ?? 0
        self.createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
        self.runId = try c.decodeIfPresent(String.self, forKey: .runId)
        self.scopeId = try c.decodeIfPresent(String.self, forKey: .scopeId)
        self.scopeName = try c.decodeIfPresent(String.self, forKey: .scopeName)
        self.testPassed = try c.decodeIfPresent(Bool.self, forKey: .testPassed)
        self.passedTests = try c.decodeIfPresent(Int64.self, forKey: .passedTests)
        self.failedTests = try c.decodeIfPresent(Int64.self, forKey: .failedTests)
        self.testResults = try c.decodeIfPresent(String.self, forKey: .testResults)
        self.responseHeaders = try c.decodeIfPresent(String.self, forKey: .responseHeaders)
        self.responseBodyText = try c.decodeIfPresent(String.self, forKey: .responseBodyText)
        self.responseBodyBase64 = try c.decodeIfPresent(String.self, forKey: .responseBodyBase64)
    }
}

public struct HistoryResponsePayload: Codable, Sendable, Equatable {
    public var responseHeaders: String?
    public var responseBodyText: String?
    public var responseBodyBase64: String?

    public init(
        responseHeaders: String? = nil,
        responseBodyText: String? = nil,
        responseBodyBase64: String? = nil
    ) {
        self.responseHeaders = responseHeaders
        self.responseBodyText = responseBodyText
        self.responseBodyBase64 = responseBodyBase64
    }
}

public struct RequestHistoryEntry: Codable, Sendable, Equatable {
    public var requestId: String
    public var workspaceId: String?
    public var method: String
    public var url: String
    public var status: UInt16
    public var durationMs: UInt64
    public var sizeBytes: Int
    public var responseHeaders: String?
    public var responseBodyText: String?
    public var responseBodyBase64: String?
    public var runId: String?
    public var scopeId: String?
    public var scopeName: String?
    public var testPassed: Bool?
    public var passedTests: Int64?
    public var failedTests: Int64?
    public var testResults: String?

    public init(
        requestId: String,
        workspaceId: String? = nil,
        method: String,
        url: String,
        status: UInt16,
        durationMs: UInt64,
        sizeBytes: Int,
        responseHeaders: String? = nil,
        responseBodyText: String? = nil,
        responseBodyBase64: String? = nil
    ) {
        self.requestId = requestId
        self.workspaceId = workspaceId
        self.method = method
        self.url = url
        self.status = status
        self.durationMs = durationMs
        self.sizeBytes = sizeBytes
        self.responseHeaders = responseHeaders
        self.responseBodyText = responseBodyText
        self.responseBodyBase64 = responseBodyBase64
    }
}

// MARK: - HTTP Execution & Request Preparation DTOs

public struct PreparedHttpRequest: Codable, Sendable, Equatable {
    public var method: String
    public var url: String
    public var headers: [HeaderEntry]
    public var body: String?
    public var bodyMimeType: String?
    public var bodyForm: [HeaderEntry]
    public var timeoutMs: UInt64
    public var followRedirects: Bool
    public var historyUrl: String
    public var effectiveAuthMode: String
    public var effectiveAuthConfig: AuthConfig
    public var authEntityId: String?
    public var authEntityType: String?

    enum CodingKeys: String, CodingKey {
        case method, url, headers, body, bodyMimeType, bodyForm
        case timeoutMs, followRedirects, historyUrl
        case effectiveAuthMode, effectiveAuthConfig, authEntityId, authEntityType
    }

    public init(
        method: String = "GET",
        url: String = "",
        headers: [HeaderEntry] = [],
        body: String? = nil,
        bodyMimeType: String? = nil,
        bodyForm: [HeaderEntry] = [],
        timeoutMs: UInt64 = 30000,
        followRedirects: Bool = true,
        historyUrl: String = "",
        effectiveAuthMode: String = "none",
        effectiveAuthConfig: AuthConfig = AuthConfig(),
        authEntityId: String? = nil,
        authEntityType: String? = nil
    ) {
        self.method = method
        self.url = url
        self.headers = headers
        self.body = body
        self.bodyMimeType = bodyMimeType
        self.bodyForm = bodyForm
        self.timeoutMs = timeoutMs
        self.followRedirects = followRedirects
        self.historyUrl = historyUrl.isEmpty ? url : historyUrl
        self.effectiveAuthMode = effectiveAuthMode
        self.effectiveAuthConfig = effectiveAuthConfig
        self.authEntityId = authEntityId
        self.authEntityType = authEntityType
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.method = try c.decode(String.self, forKey: .method)
        self.url = try c.decode(String.self, forKey: .url)
        self.headers = try c.decodeIfPresent([HeaderEntry].self, forKey: .headers) ?? []
        self.body = try c.decodeIfPresent(String.self, forKey: .body)
        self.bodyMimeType = try c.decodeIfPresent(String.self, forKey: .bodyMimeType)
        self.bodyForm = try c.decodeIfPresent([HeaderEntry].self, forKey: .bodyForm) ?? []
        self.timeoutMs = try c.decodeIfPresent(UInt64.self, forKey: .timeoutMs) ?? 30000
        self.followRedirects = try c.decodeIfPresent(Bool.self, forKey: .followRedirects) ?? true
        self.historyUrl = try c.decodeIfPresent(String.self, forKey: .historyUrl) ?? self.url
        self.effectiveAuthMode = try c.decodeIfPresent(String.self, forKey: .effectiveAuthMode) ?? "none"
        self.effectiveAuthConfig = try c.decodeIfPresent(AuthConfig.self, forKey: .effectiveAuthConfig) ?? AuthConfig()
        self.authEntityId = try c.decodeIfPresent(String.self, forKey: .authEntityId)
        self.authEntityType = try c.decodeIfPresent(String.self, forKey: .authEntityType)
    }

    public func toExecuteHttpRequest() -> ExecuteHttpRequest {
        ExecuteHttpRequest(
            method: method,
            url: url,
            headers: headers,
            body: body,
            bodyMimeType: bodyMimeType,
            bodyForm: bodyForm,
            timeoutMs: timeoutMs,
            followRedirects: followRedirects
        )
    }
}

public struct ExecuteHttpRequest: Codable, Sendable, Equatable {
    public var method: String
    public var url: String
    public var headers: [HeaderEntry]
    public var body: String?
    public var bodyMimeType: String?
    public var bodyForm: [HeaderEntry]
    public var timeoutMs: UInt64
    public var followRedirects: Bool

    public init(
        method: String,
        url: String,
        headers: [HeaderEntry] = [],
        body: String? = nil,
        bodyMimeType: String? = nil,
        bodyForm: [HeaderEntry] = [],
        timeoutMs: UInt64 = 30000,
        followRedirects: Bool = true
    ) {
        self.method = method
        self.url = url
        self.headers = headers
        self.body = body
        self.bodyMimeType = bodyMimeType
        self.bodyForm = bodyForm
        self.timeoutMs = timeoutMs
        self.followRedirects = followRedirects
    }
}

public struct ExecuteHttpResponse: Codable, Sendable, Equatable {
    public var status: UInt16
    public var statusText: String
    public var headers: [HeaderEntry]
    public var bodyText: String?
    public var bodyBase64: String?
    public var durationMs: UInt64
    public var dnsMs: UInt64
    public var connectMs: UInt64
    public var tlsMs: UInt64
    public var requestMs: UInt64
    public var sizeBytes: Int
    public var contentType: String?

    enum CodingKeys: String, CodingKey {
        case status, statusText, headers, bodyText, bodyBase64
        case durationMs, dnsMs, connectMs, tlsMs, requestMs, sizeBytes, contentType
    }

    public init(
        status: UInt16,
        statusText: String,
        headers: [HeaderEntry] = [],
        bodyText: String? = nil,
        bodyBase64: String? = nil,
        durationMs: UInt64 = 0,
        dnsMs: UInt64 = 0,
        connectMs: UInt64 = 0,
        tlsMs: UInt64 = 0,
        requestMs: UInt64 = 0,
        sizeBytes: Int = 0,
        contentType: String? = nil
    ) {
        self.status = status
        self.statusText = statusText
        self.headers = headers
        self.bodyText = bodyText
        self.bodyBase64 = bodyBase64
        self.durationMs = durationMs
        self.dnsMs = dnsMs
        self.connectMs = connectMs
        self.tlsMs = tlsMs
        self.requestMs = requestMs
        self.sizeBytes = sizeBytes
        self.contentType = contentType
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.status = try c.decode(UInt16.self, forKey: .status)
        self.statusText = try c.decodeIfPresent(String.self, forKey: .statusText) ?? ""
        self.headers = try c.decodeIfPresent([HeaderEntry].self, forKey: .headers) ?? []
        self.bodyText = try c.decodeIfPresent(String.self, forKey: .bodyText)
        self.bodyBase64 = try c.decodeIfPresent(String.self, forKey: .bodyBase64)
        self.durationMs = try c.decodeIfPresent(UInt64.self, forKey: .durationMs) ?? 0
        self.dnsMs = try c.decodeIfPresent(UInt64.self, forKey: .dnsMs) ?? 0
        self.connectMs = try c.decodeIfPresent(UInt64.self, forKey: .connectMs) ?? 0
        self.tlsMs = try c.decodeIfPresent(UInt64.self, forKey: .tlsMs) ?? 0
        self.requestMs = try c.decodeIfPresent(UInt64.self, forKey: .requestMs) ?? 0
        self.sizeBytes = try c.decodeIfPresent(Int.self, forKey: .sizeBytes) ?? 0
        self.contentType = try c.decodeIfPresent(String.self, forKey: .contentType)
    }

    public var statusColor: Color {
        switch status {
        case 200..<300: return .green
        case 300..<400: return .teal
        case 400..<500: return .orange
        default: return .red
        }
    }

    public var prettyPrintedBody: String {
        guard let text = bodyText else {
            if let b64 = bodyBase64 {
                return "<Binary payload: \(b64.count) base64 chars>"
            }
            return ""
        }
        guard let data = text.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data),
              JSONSerialization.isValidJSONObject(object),
              let prettyData = try? JSONSerialization.data(
                  withJSONObject: object,
                  options: [.prettyPrinted, .sortedKeys]
              ),
              let pretty = String(data: prettyData, encoding: .utf8) else {
            return text
        }
        return pretty
    }
}

// MARK: - Importer DTOs

public struct ImportStats: Codable, Sendable, Equatable {
    public var collectionsCount: Int
    public var foldersCount: Int
    public var requestsCount: Int
    public var environmentsCount: Int
    public var variablesCount: Int

    enum CodingKeys: String, CodingKey {
        case collectionsCount, foldersCount, requestsCount, environmentsCount, variablesCount
    }

    public init(
        collectionsCount: Int = 0,
        foldersCount: Int = 0,
        requestsCount: Int = 0,
        environmentsCount: Int = 0,
        variablesCount: Int = 0
    ) {
        self.collectionsCount = collectionsCount
        self.foldersCount = foldersCount
        self.requestsCount = requestsCount
        self.environmentsCount = environmentsCount
        self.variablesCount = variablesCount
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.collectionsCount = try c.decodeIfPresent(Int.self, forKey: .collectionsCount) ?? 0
        self.foldersCount = try c.decodeIfPresent(Int.self, forKey: .foldersCount) ?? 0
        self.requestsCount = try c.decodeIfPresent(Int.self, forKey: .requestsCount) ?? 0
        self.environmentsCount = try c.decodeIfPresent(Int.self, forKey: .environmentsCount) ?? 0
        self.variablesCount = try c.decodeIfPresent(Int.self, forKey: .variablesCount) ?? 0
    }
}

public struct NormalizedImportResult: Sendable, Equatable {
    public var format: String
    public var formatLabel: String
    public var title: String
    public var stats: ImportStats
    public var exportDataJson: String

    public init(
        format: String,
        formatLabel: String,
        title: String,
        stats: ImportStats,
        exportDataJson: String
    ) {
        self.format = format
        self.formatLabel = formatLabel
        self.title = title
        self.stats = stats
        self.exportDataJson = exportDataJson
    }
}

public struct CurlImportResult: Codable, Sendable, Equatable {
    public var method: String
    public var customMethod: String?
    public var url: String
    public var headers: [HeaderEntry]
    public var body: String
    public var bodyMimeType: String
    public var bodyForm: [HeaderEntry]
    public var authMode: String
    public var authConfig: AuthConfig

    enum CodingKeys: String, CodingKey {
        case method, customMethod, url, headers, body, bodyMimeType, bodyForm, authMode, authConfig
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.method = try c.decodeIfPresent(String.self, forKey: .method) ?? "GET"
        self.customMethod = try c.decodeIfPresent(String.self, forKey: .customMethod)
        self.url = try c.decodeIfPresent(String.self, forKey: .url) ?? ""
        self.headers = try c.decodeIfPresent([HeaderEntry].self, forKey: .headers) ?? []
        self.body = try c.decodeIfPresent(String.self, forKey: .body) ?? ""
        self.bodyMimeType = try c.decodeIfPresent(String.self, forKey: .bodyMimeType) ?? "text/plain"
        self.bodyForm = try c.decodeIfPresent([HeaderEntry].self, forKey: .bodyForm) ?? []
        self.authMode = try c.decodeIfPresent(String.self, forKey: .authMode) ?? "none"
        self.authConfig = try c.decodeIfPresent(AuthConfig.self, forKey: .authConfig) ?? AuthConfig()
    }
}

// MARK: - Scripts & GraphQL Helpers

public struct ScriptRecord: Codable, Sendable, Identifiable, Hashable {
    public var id: String
    public var entityId: String
    public var entityType: String
    public var scriptType: String
    public var content: String
    public var position: Int64

    enum CodingKeys: String, CodingKey {
        case id, entityId, entityType, scriptType, content, position
    }

    public init(
        id: String = "",
        entityId: String,
        entityType: String,
        scriptType: String,
        content: String = "",
        position: Int64 = 0
    ) {
        self.id = id
        self.entityId = entityId
        self.entityType = entityType
        self.scriptType = scriptType
        self.content = content
        self.position = position
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        self.entityId = try c.decodeIfPresent(String.self, forKey: .entityId) ?? ""
        self.entityType = try c.decodeIfPresent(String.self, forKey: .entityType) ?? "request"
        self.scriptType = try c.decodeIfPresent(String.self, forKey: .scriptType) ?? "pre"
        self.content = try c.decodeIfPresent(String.self, forKey: .content) ?? ""
        self.position = try c.decodeIfPresent(Int64.self, forKey: .position) ?? 0
    }
}

public enum GraphQLQuery {
    public static let introspectionQuery: String = """
    query IntrospectionQuery {
      __schema {
        queryType { name }
        mutationType { name }
        subscriptionType { name }
        types {
          kind
          name
          description
          fields(includeDeprecated: true) {
            name
            description
            type {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
        }
      }
    }
    """
}

// MARK: - Workbench Tab Model

public struct RequestTab: Sendable, Identifiable, Equatable {
    public let id: UUID
    public var request: SavedRequest
    public var customMethod: String
    public var isDirty: Bool
    public var isPersisted: Bool
    public var responseState: ResponseState
    public var inspectorTab: RequestInspectorTab
    public var responseInspectorTab: ResponseInspectorTab
    public var preScript: String
    public var postScript: String
    public var testResults: [ScriptTestResult]
    public var scriptLogs: [ScriptLogEntry]

    public init(
        id: UUID = UUID(),
        request: SavedRequest,
        customMethod: String = "",
        isDirty: Bool = false,
        isPersisted: Bool = true,
        responseState: ResponseState = .idle,
        inspectorTab: RequestInspectorTab = .params,
        responseInspectorTab: ResponseInspectorTab = .body,
        preScript: String = "",
        postScript: String = "",
        testResults: [ScriptTestResult] = [],
        scriptLogs: [ScriptLogEntry] = []
    ) {
        self.id = id
        self.request = request
        self.customMethod = customMethod
        self.isDirty = isDirty
        self.isPersisted = isPersisted
        self.responseState = responseState
        self.inspectorTab = inspectorTab
        self.responseInspectorTab = responseInspectorTab
        self.preScript = preScript
        self.postScript = postScript
        self.testResults = testResults
        self.scriptLogs = scriptLogs
    }

    public var title: String {
        let trimmed = request.name.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Untitled Request" : trimmed
    }

    public var methodBadge: HTTPMethod {
        HTTPMethod.from(request.method)
    }
}
