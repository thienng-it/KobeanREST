import AppKit
import AuthenticationServices
import CryptoKit
import Foundation
import Security
import os

// MARK: - Models

public enum OAuthGrantType: String, Sendable, Codable, CaseIterable, Equatable {
    case clientCredentials = "client_credentials"
    case passwordCredentials = "password_credentials"
    case authorizationCode = "authorization_code"

    public var protocolGrantType: String {
        switch self {
        case .clientCredentials:
            return "client_credentials"
        case .passwordCredentials:
            return "password"
        case .authorizationCode:
            return "authorization_code"
        }
    }
}

public struct OAuthPKCEPair: Sendable, Equatable, CustomStringConvertible, CustomDebugStringConvertible {
    public let codeVerifier: String
    public let codeChallenge: String
    public let codeChallengeMethod: String

    public init(codeVerifier: String, codeChallenge: String, codeChallengeMethod: String = "S256") {
        self.codeVerifier = codeVerifier
        self.codeChallenge = codeChallenge
        self.codeChallengeMethod = codeChallengeMethod
    }

    public var description: String {
        "OAuthPKCEPair(codeChallenge: \(codeChallenge), codeChallengeMethod: \(codeChallengeMethod), codeVerifier: [redacted])"
    }

    public var debugDescription: String { description }
}

public struct OAuthAuthorizationRequest: Sendable, Equatable {
    public let authorizationEndpoint: URL
    public let clientId: String
    public let redirectURI: URL
    public let scope: String?
    public let audience: String?
    public let state: String
    public let pkce: OAuthPKCEPair
    public let extraQueryParameters: [String: String]

    public init(
        authorizationEndpoint: URL,
        clientId: String,
        redirectURI: URL,
        scope: String? = nil,
        audience: String? = nil,
        state: String,
        pkce: OAuthPKCEPair,
        extraQueryParameters: [String: String] = [:]
    ) {
        self.authorizationEndpoint = authorizationEndpoint
        self.clientId = clientId
        self.redirectURI = redirectURI
        self.scope = scope
        self.audience = audience
        self.state = state
        self.pkce = pkce
        self.extraQueryParameters = extraQueryParameters
    }

    public func buildAuthorizationURL() throws -> URL {
        try OAuthSessionService.validateEndpointURL(authorizationEndpoint, context: "authorizationEndpoint")
        guard !clientId.isEmpty else {
            throw OAuthSessionError.missingRequiredParameter("clientId")
        }
        guard !state.isEmpty else {
            throw OAuthSessionError.missingRequiredParameter("state")
        }
        guard !pkce.codeChallenge.isEmpty else {
            throw OAuthSessionError.missingRequiredParameter("codeChallenge")
        }
        guard var components = URLComponents(url: authorizationEndpoint, resolvingAgainstBaseURL: false) else {
            throw OAuthSessionError.invalidURL("authorizationEndpoint")
        }

        let reservedKeys: Set<String> = [
            "response_type",
            "client_id",
            "redirect_uri",
            "state",
            "code_challenge",
            "code_challenge_method",
            "scope",
            "audience"
        ]

        var items = components.queryItems ?? []
        items.removeAll { reservedKeys.contains($0.name.lowercased()) }

        items.append(URLQueryItem(name: "response_type", value: "code"))
        items.append(URLQueryItem(name: "client_id", value: clientId))
        items.append(URLQueryItem(name: "redirect_uri", value: redirectURI.absoluteString))
        items.append(URLQueryItem(name: "state", value: state))
        items.append(URLQueryItem(name: "code_challenge", value: pkce.codeChallenge))
        items.append(URLQueryItem(name: "code_challenge_method", value: pkce.codeChallengeMethod))

        if let scope, !scope.isEmpty {
            items.append(URLQueryItem(name: "scope", value: scope))
        }
        if let audience, !audience.isEmpty {
            items.append(URLQueryItem(name: "audience", value: audience))
        }

        for key in extraQueryParameters.keys.sorted() where !reservedKeys.contains(key.lowercased()) {
            if let value = extraQueryParameters[key] {
                items.append(URLQueryItem(name: key, value: value))
            }
        }

        components.queryItems = items
        guard let url = components.url else {
            throw OAuthSessionError.invalidURL("authorizationURL")
        }
        return url
    }
}

public struct OAuthAuthorizationCallback: Sendable, Equatable {
    public let code: String
    public let state: String

    public init(code: String, state: String) {
        self.code = code
        self.state = state
    }
}

public struct OAuthTokenRequest: Sendable, Equatable, CustomStringConvertible, CustomDebugStringConvertible {
    public let tokenEndpoint: URL
    public let grantType: OAuthGrantType
    public let clientId: String?
    public let clientSecret: String?
    public let scope: String?
    public let audience: String?
    public let username: String?
    public let password: String?
    public let code: String?
    public let redirectURI: URL?
    public let codeVerifier: String?
    public let useBasicAuthHeader: Bool

    public init(
        tokenEndpoint: URL,
        grantType: OAuthGrantType,
        clientId: String? = nil,
        clientSecret: String? = nil,
        scope: String? = nil,
        audience: String? = nil,
        username: String? = nil,
        password: String? = nil,
        code: String? = nil,
        redirectURI: URL? = nil,
        codeVerifier: String? = nil,
        useBasicAuthHeader: Bool = true
    ) {
        self.tokenEndpoint = tokenEndpoint
        self.grantType = grantType
        self.clientId = clientId
        self.clientSecret = clientSecret
        self.scope = scope
        self.audience = audience
        self.username = username
        self.password = password
        self.code = code
        self.redirectURI = redirectURI
        self.codeVerifier = codeVerifier
        self.useBasicAuthHeader = useBasicAuthHeader
    }

    public static func clientCredentials(
        tokenEndpoint: URL,
        clientId: String?,
        clientSecret: String?,
        scope: String? = nil,
        audience: String? = nil,
        useBasicAuthHeader: Bool = true
    ) -> OAuthTokenRequest {
        OAuthTokenRequest(
            tokenEndpoint: tokenEndpoint,
            grantType: .clientCredentials,
            clientId: clientId,
            clientSecret: clientSecret,
            scope: scope,
            audience: audience,
            useBasicAuthHeader: useBasicAuthHeader
        )
    }

    public static func passwordCredentials(
        tokenEndpoint: URL,
        username: String,
        password: String,
        clientId: String? = nil,
        clientSecret: String? = nil,
        scope: String? = nil,
        audience: String? = nil,
        useBasicAuthHeader: Bool = true
    ) -> OAuthTokenRequest {
        OAuthTokenRequest(
            tokenEndpoint: tokenEndpoint,
            grantType: .passwordCredentials,
            clientId: clientId,
            clientSecret: clientSecret,
            scope: scope,
            audience: audience,
            username: username,
            password: password,
            useBasicAuthHeader: useBasicAuthHeader
        )
    }

    public static func authorizationCode(
        tokenEndpoint: URL,
        code: String,
        redirectURI: URL?,
        codeVerifier: String,
        clientId: String? = nil,
        clientSecret: String? = nil,
        useBasicAuthHeader: Bool = true
    ) -> OAuthTokenRequest {
        OAuthTokenRequest(
            tokenEndpoint: tokenEndpoint,
            grantType: .authorizationCode,
            clientId: clientId,
            clientSecret: clientSecret,
            code: code,
            redirectURI: redirectURI,
            codeVerifier: codeVerifier,
            useBasicAuthHeader: useBasicAuthHeader
        )
    }

    public var description: String {
        let secretState = (clientSecret?.isEmpty == false) ? "[redacted]" : "nil"
        let passwordState = (password?.isEmpty == false) ? "[redacted]" : "nil"
        let verifierState = (codeVerifier?.isEmpty == false) ? "[redacted]" : "nil"
        return "OAuthTokenRequest(tokenEndpoint: \(tokenEndpoint.host ?? "<url>"), grantType: \(grantType.rawValue), clientId: \(clientId ?? "nil"), clientSecret: \(secretState), password: \(passwordState), codeVerifier: \(verifierState))"
    }

    public var debugDescription: String { description }
}

public struct OAuthRefreshRequest: Sendable, Equatable, CustomStringConvertible, CustomDebugStringConvertible {
    public let tokenEndpoint: URL
    public let refreshToken: String
    public let clientId: String?
    public let clientSecret: String?
    public let scope: String?
    public let useBasicAuthHeader: Bool

    public init(
        tokenEndpoint: URL,
        refreshToken: String,
        clientId: String? = nil,
        clientSecret: String? = nil,
        scope: String? = nil,
        useBasicAuthHeader: Bool = true
    ) {
        self.tokenEndpoint = tokenEndpoint
        self.refreshToken = refreshToken
        self.clientId = clientId
        self.clientSecret = clientSecret
        self.scope = scope
        self.useBasicAuthHeader = useBasicAuthHeader
    }

    public var description: String {
        let secretState = (clientSecret?.isEmpty == false) ? "[redacted]" : "nil"
        return "OAuthRefreshRequest(tokenEndpoint: \(tokenEndpoint.host ?? "<url>"), refreshToken: [redacted], clientId: \(clientId ?? "nil"), clientSecret: \(secretState))"
    }

    public var debugDescription: String { description }
}

public struct OAuthTokenResult: Sendable, Equatable, Codable, CustomStringConvertible, CustomDebugStringConvertible {
    public let accessToken: String
    public let refreshToken: String?
    public let expiresAtEpochMs: Int64?
    public let tokenType: String

    public init(
        accessToken: String,
        refreshToken: String? = nil,
        expiresAtEpochMs: Int64? = nil,
        tokenType: String = "Bearer"
    ) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.expiresAtEpochMs = expiresAtEpochMs
        self.tokenType = tokenType
    }

    public var description: String {
        let refreshState = refreshToken != nil ? "[redacted]" : "nil"
        return "OAuthTokenResult(accessToken: [redacted], refreshToken: \(refreshState), expiresAtEpochMs: \(expiresAtEpochMs.map(String.init) ?? "nil"), tokenType: \(tokenType))"
    }

    public var debugDescription: String { description }
}

// MARK: - Errors

public enum OAuthSessionError: Error, LocalizedError, CustomStringConvertible, CustomDebugStringConvertible, Equatable, Sendable {
    case randomGenerationFailed(status: OSStatus)
    case invalidPKCEByteCount(Int)
    case invalidStateByteCount(Int)
    case invalidURL(String)
    case missingRequiredParameter(String)
    case invalidCallbackURL
    case invalidCallbackScheme(expected: String, actual: String?)
    case invalidCallbackRedirectURI
    case missingState
    case stateMismatch
    case providerError(error: String, description: String?)
    case missingAuthorizationCode
    case sessionCancelled
    case sessionFailed(reason: String)
    case httpError(statusCode: Int, oauthError: String?, oauthErrorDescription: String?)
    case invalidTokenResponse(reason: String)
    case transportError(reason: String)

    public var errorDescription: String? {
        switch self {
        case .randomGenerationFailed(let status):
            return "Failed to generate cryptographically random bytes (OSStatus \(status))"
        case .invalidPKCEByteCount(let count):
            return "PKCE entropy byte count \(count) is outside the valid RFC 7636 range (32...96)"
        case .invalidStateByteCount(let count):
            return "OAuth state entropy byte count \(count) must be at least 16 bytes"
        case .invalidURL(let context):
            return "Invalid URL for \(context)"
        case .missingRequiredParameter(let name):
            return "Missing required OAuth parameter: \(name)"
        case .invalidCallbackURL:
            return "OAuth callback URL is malformed"
        case .invalidCallbackScheme(let expected, let actual):
            return "OAuth callback scheme mismatch (expected '\(expected)', got '\(actual ?? "nil")')"
        case .invalidCallbackRedirectURI:
            return "OAuth callback URL does not match expected redirect URI"
        case .missingState:
            return "OAuth callback is missing required CSRF state parameter"
        case .stateMismatch:
            return "OAuth callback CSRF state validation failed"
        case .providerError(let error, let description):
            if let description, !description.isEmpty {
                return "OAuth authorization failed (\(error)): \(description)"
            }
            return "OAuth authorization failed (\(error))"
        case .missingAuthorizationCode:
            return "OAuth callback did not contain an authorization code"
        case .sessionCancelled:
            return "OAuth login session was cancelled by the user"
        case .sessionFailed(let reason):
            return "OAuth authentication session failed: \(reason)"
        case .httpError(let statusCode, let oauthError, let oauthErrorDescription):
            switch (oauthError, oauthErrorDescription) {
            case let (err?, desc?) where !desc.isEmpty:
                return "OAuth token request failed (HTTP \(statusCode), \(err)): \(desc)"
            case let (err?, _):
                return "OAuth token request failed (HTTP \(statusCode), \(err))"
            case let (_, desc?) where !desc.isEmpty:
                return "OAuth token request failed (HTTP \(statusCode)): \(desc)"
            default:
                return "OAuth token request failed (HTTP \(statusCode))"
            }
        case .invalidTokenResponse(let reason):
            return "Invalid OAuth token response: \(reason)"
        case .transportError(let reason):
            return "OAuth network transport error: \(reason)"
        }
    }

    public var description: String { errorDescription ?? "OAuthSessionError" }
    public var debugDescription: String { description }
}

// MARK: - Transport & Session Abstractions

public protocol OAuthHTTPTransport: Sendable {
    func data(for request: URLRequest) async throws -> (Data, URLResponse)
}

public struct URLSessionOAuthTransport: OAuthHTTPTransport {
    private let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        try await session.data(for: request)
    }
}

@MainActor
public protocol OAuthWebAuthSessionRunner: AnyObject {
    func authenticate(
        url: URL,
        callbackURLScheme: String,
        prefersEphemeralWebBrowserSession: Bool,
        presentationAnchor: NSWindow?
    ) async throws -> URL
}

@MainActor
public final class WindowPresentationContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    private weak var anchorWindow: NSWindow?

    public init(window: NSWindow?) {
        self.anchorWindow = window
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        if let anchorWindow {
            return anchorWindow
        }
        if let keyWindow = NSApp?.keyWindow {
            return keyWindow
        }
        if let mainWindow = NSApp?.mainWindow {
            return mainWindow
        }
        if let firstWindow = NSApp?.windows.first {
            return firstWindow
        }
        return ASPresentationAnchor()
    }
}

@MainActor
public final class SystemASWebAuthenticationSessionRunner: OAuthWebAuthSessionRunner {
    private var activeSessions: [UUID: (ASWebAuthenticationSession, WindowPresentationContextProvider)] = [:]

    public init() {}

    public func authenticate(
        url: URL,
        callbackURLScheme: String,
        prefersEphemeralWebBrowserSession: Bool,
        presentationAnchor: NSWindow?
    ) async throws -> URL {
        let sessionId = UUID()
        let contextProvider = WindowPresentationContextProvider(window: presentationAnchor)
        defer {
            activeSessions.removeValue(forKey: sessionId)
        }

        return try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: callbackURLScheme
            ) { callbackURL, error in
                if let error {
                    if let authError = error as? ASWebAuthenticationSessionError,
                       authError.code == .canceledLogin {
                        continuation.resume(throwing: OAuthSessionError.sessionCancelled)
                    } else {
                        continuation.resume(
                            throwing: OAuthSessionError.sessionFailed(
                                reason: OAuthRedactor.redact(error.localizedDescription, secrets: [])
                            )
                        )
                    }
                    return
                }

                guard let callbackURL else {
                    continuation.resume(throwing: OAuthSessionError.invalidCallbackURL)
                    return
                }

                continuation.resume(returning: callbackURL)
            }

            session.presentationContextProvider = contextProvider
            session.prefersEphemeralWebBrowserSession = prefersEphemeralWebBrowserSession

            activeSessions[sessionId] = (session, contextProvider)
            if !session.start() {
                activeSessions.removeValue(forKey: sessionId)
                continuation.resume(
                    throwing: OAuthSessionError.sessionFailed(
                        reason: "Unable to start ASWebAuthenticationSession"
                    )
                )
            }
        }
    }
}

// MARK: - Redaction Helper

enum OAuthRedactor {
    private static let sensitiveKeyPattern = try? NSRegularExpression(
        pattern: #"(?i)(access_token|refresh_token|client_secret|code_verifier|password|id_token)(["']?\s*[:=]\s*["']?)([^\s,&"']+)"#
    )
    private static let authHeaderPattern = try? NSRegularExpression(
        pattern: #"(?i)(authorization\s*[:=]\s*(?:Basic|Bearer)\s+)([^\s,"']+)"#
    )

    static func redact(_ text: String, secrets: [String?]) -> String {
        var sanitized = text
        for secret in secrets {
            guard let secret, !secret.isEmpty else { continue }
            sanitized = sanitized.replacingOccurrences(of: secret, with: "[redacted]")
        }
        if let regex = sensitiveKeyPattern {
            let range = NSRange(sanitized.startIndex..<sanitized.endIndex, in: sanitized)
            sanitized = regex.stringByReplacingMatches(
                in: sanitized,
                options: [],
                range: range,
                withTemplate: "$1$2[redacted]"
            )
        }
        if let authRegex = authHeaderPattern {
            let range = NSRange(sanitized.startIndex..<sanitized.endIndex, in: sanitized)
            sanitized = authRegex.stringByReplacingMatches(
                in: sanitized,
                options: [],
                range: range,
                withTemplate: "$1[redacted]"
            )
        }
        return sanitized
    }
}

// MARK: - OAuthSessionService

@MainActor
public final class OAuthSessionService {
    private static let logger = Logger(subsystem: "com.kobeanrest.macos", category: "OAuthSessionService")

    public var prefersEphemeralWebBrowserSession: Bool
    private let webAuthRunner: OAuthWebAuthSessionRunner
    private let httpTransport: OAuthHTTPTransport
    private let nowProvider: @Sendable () -> Date

    public init(
        prefersEphemeralWebBrowserSession: Bool = true,
        webAuthRunner: OAuthWebAuthSessionRunner? = nil,
        httpTransport: OAuthHTTPTransport = URLSessionOAuthTransport(),
        nowProvider: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.prefersEphemeralWebBrowserSession = prefersEphemeralWebBrowserSession
        self.webAuthRunner = webAuthRunner ?? SystemASWebAuthenticationSessionRunner()
        self.httpTransport = httpTransport
        self.nowProvider = nowProvider
    }

    // MARK: - PKCE & State (RFC 7636 + T-01)

    public nonisolated static func generatePKCEPair(byteCount: Int = 32) throws -> OAuthPKCEPair {
        guard (32...96).contains(byteCount) else {
            throw OAuthSessionError.invalidPKCEByteCount(byteCount)
        }
        let verifier = base64URLEncode(try randomBytes(count: byteCount))
        let challenge = codeChallengeS256(for: verifier)
        return OAuthPKCEPair(
            codeVerifier: verifier,
            codeChallenge: challenge,
            codeChallengeMethod: "S256"
        )
    }

    public nonisolated static func codeChallengeS256(for codeVerifier: String) -> String {
        let digest = SHA256.hash(data: Data(codeVerifier.utf8))
        return base64URLEncode(Data(digest))
    }

    public nonisolated static func generateState(byteCount: Int = 32) throws -> String {
        guard byteCount >= 16 else {
            throw OAuthSessionError.invalidStateByteCount(byteCount)
        }
        return base64URLEncode(try randomBytes(count: byteCount))
    }

    public nonisolated static func base64URLEncode(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private nonisolated static func randomBytes(count: Int) throws -> Data {
        var bytes = [UInt8](repeating: 0, count: count)
        let status = bytes.withUnsafeMutableBytes { buffer -> OSStatus in
            guard let baseAddress = buffer.baseAddress else {
                return errSecParam
            }
            return SecRandomCopyBytes(kSecRandomDefault, count, baseAddress)
        }
        guard status == errSecSuccess else {
            throw OAuthSessionError.randomGenerationFailed(status: status)
        }
        return Data(bytes)
    }

    // MARK: - Strict Fail-Closed Callback Parser (T-01)

    public nonisolated static func parseCallbackURL(
        _ callbackURL: URL,
        expectedScheme: String,
        expectedState: String,
        expectedRedirectURI: URL? = nil
    ) throws -> OAuthAuthorizationCallback {
        guard !expectedScheme.isEmpty else {
            throw OAuthSessionError.missingRequiredParameter("expectedScheme")
        }
        guard !expectedState.isEmpty else {
            throw OAuthSessionError.missingRequiredParameter("expectedState")
        }
        guard let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false) else {
            throw OAuthSessionError.invalidCallbackURL
        }
        guard let actualScheme = components.scheme,
              !actualScheme.isEmpty,
              actualScheme.caseInsensitiveCompare(expectedScheme) == .orderedSame else {
            throw OAuthSessionError.invalidCallbackScheme(expected: expectedScheme, actual: components.scheme)
        }

        if let expectedRedirectURI {
            guard let expectedComponents = URLComponents(url: expectedRedirectURI, resolvingAgainstBaseURL: false),
                  let redirectScheme = expectedComponents.scheme,
                  redirectScheme.caseInsensitiveCompare(expectedScheme) == .orderedSame else {
                throw OAuthSessionError.invalidCallbackRedirectURI
            }
            let expectedHost = (expectedComponents.host ?? "").lowercased()
            let actualHost = (components.host ?? "").lowercased()
            if expectedHost != actualHost || expectedComponents.path != components.path {
                throw OAuthSessionError.invalidCallbackRedirectURI
            }
        }

        let queryItems = components.queryItems ?? []

        // Fail closed on missing, empty, duplicate, or mismatched CSRF state
        let stateItems = queryItems.filter { $0.name == "state" }
        guard stateItems.count <= 1 else {
            throw OAuthSessionError.stateMismatch
        }
        guard let receivedState = stateItems.first?.value, !receivedState.isEmpty else {
            throw OAuthSessionError.missingState
        }
        guard constantTimeEqual(receivedState, expectedState) else {
            throw OAuthSessionError.stateMismatch
        }

        // Fail closed if provider returned an OAuth error
        if let oauthError = queryItems.first(where: { $0.name == "error" })?.value, !oauthError.isEmpty {
            let description = queryItems
                .first(where: { $0.name == "error_description" })?
                .value
                .map { OAuthRedactor.redact($0, secrets: []) }
            throw OAuthSessionError.providerError(error: oauthError, description: description)
        }

        // Reject duplicate or missing authorization codes
        let codeItems = queryItems.filter { $0.name == "code" }
        guard codeItems.count == 1, let code = codeItems.first?.value, !code.isEmpty else {
            throw OAuthSessionError.missingAuthorizationCode
        }

        return OAuthAuthorizationCallback(code: code, state: receivedState)
    }

    private nonisolated static func constantTimeEqual(_ lhs: String, _ rhs: String) -> Bool {
        let lhsBytes = Array(lhs.utf8)
        let rhsBytes = Array(rhs.utf8)
        guard lhsBytes.count == rhsBytes.count else {
            return false
        }
        var diff: UInt8 = 0
        for index in lhsBytes.indices {
            diff |= lhsBytes[index] ^ rhsBytes[index]
        }
        return diff == 0
    }

    // MARK: - Endpoint Scheme Validation

    public nonisolated static func validateEndpointURL(_ url: URL, context: String) throws {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let scheme = components.scheme?.lowercased(),
              let host = components.host?.lowercased(),
              !host.isEmpty else {
            throw OAuthSessionError.invalidURL(context)
        }
        if scheme == "https" {
            return
        }
        let loopbackHosts: Set<String> = ["localhost", "127.0.0.1", "::1", "[::1]"]
        if scheme == "http", loopbackHosts.contains(host) {
            return
        }
        throw OAuthSessionError.invalidURL(context)
    }

    // MARK: - ASWebAuthenticationSession Coordinator

    public func authorize(
        authorizationEndpoint: URL,
        clientId: String,
        redirectURI: URL,
        scope: String? = nil,
        audience: String? = nil,
        extraQueryParameters: [String: String] = [:],
        prefersEphemeralWebBrowserSession: Bool? = nil,
        presentationAnchor: NSWindow? = nil
    ) async throws -> (callback: OAuthAuthorizationCallback, pkce: OAuthPKCEPair) {
        try Self.validateEndpointURL(authorizationEndpoint, context: "authorizationEndpoint")
        guard let callbackScheme = redirectURI.scheme, !callbackScheme.isEmpty else {
            throw OAuthSessionError.invalidURL("redirectURI")
        }

        let pkce = try Self.generatePKCEPair()
        let state = try Self.generateState()
        let authRequest = OAuthAuthorizationRequest(
            authorizationEndpoint: authorizationEndpoint,
            clientId: clientId,
            redirectURI: redirectURI,
            scope: scope,
            audience: audience,
            state: state,
            pkce: pkce,
            extraQueryParameters: extraQueryParameters
        )
        let authorizationURL = try authRequest.buildAuthorizationURL()
        let ephemeral = prefersEphemeralWebBrowserSession ?? self.prefersEphemeralWebBrowserSession

        Self.logger.debug("Starting ASWebAuthenticationSession (ephemeral: \(ephemeral, privacy: .public))")

        let callbackURL = try await webAuthRunner.authenticate(
            url: authorizationURL,
            callbackURLScheme: callbackScheme,
            prefersEphemeralWebBrowserSession: ephemeral,
            presentationAnchor: presentationAnchor
        )

        let callback = try Self.parseCallbackURL(
            callbackURL,
            expectedScheme: callbackScheme,
            expectedState: state,
            expectedRedirectURI: redirectURI
        )

        return (callback, pkce)
    }

    public func authorizeAndExchangeCode(
        authorizationEndpoint: URL,
        tokenEndpoint: URL,
        clientId: String,
        clientSecret: String? = nil,
        redirectURI: URL,
        scope: String? = nil,
        audience: String? = nil,
        extraQueryParameters: [String: String] = [:],
        prefersEphemeralWebBrowserSession: Bool? = nil,
        presentationAnchor: NSWindow? = nil,
        useBasicAuthHeader: Bool = true
    ) async throws -> OAuthTokenResult {
        try Self.validateEndpointURL(authorizationEndpoint, context: "authorizationEndpoint")
        try Self.validateEndpointURL(tokenEndpoint, context: "tokenEndpoint")
        let (callback, pkce) = try await authorize(
            authorizationEndpoint: authorizationEndpoint,
            clientId: clientId,
            redirectURI: redirectURI,
            scope: scope,
            audience: audience,
            extraQueryParameters: extraQueryParameters,
            prefersEphemeralWebBrowserSession: prefersEphemeralWebBrowserSession,
            presentationAnchor: presentationAnchor
        )

        let tokenRequest = OAuthTokenRequest.authorizationCode(
            tokenEndpoint: tokenEndpoint,
            code: callback.code,
            redirectURI: redirectURI,
            codeVerifier: pkce.codeVerifier,
            clientId: clientId,
            clientSecret: clientSecret,
            useBasicAuthHeader: useBasicAuthHeader
        )
        return try await exchangeToken(tokenRequest)
    }

    // MARK: - Token Exchange & Refresh

    public func exchangeToken(_ request: OAuthTokenRequest) async throws -> OAuthTokenResult {
        try Self.validateEndpointURL(request.tokenEndpoint, context: "tokenEndpoint")
        var formParams: [(String, String)] = [
            ("grant_type", request.grantType.protocolGrantType)
        ]

        switch request.grantType {
        case .clientCredentials:
            break

        case .passwordCredentials:
            guard let username = request.username, !username.isEmpty else {
                throw OAuthSessionError.missingRequiredParameter("username")
            }
            guard let password = request.password, !password.isEmpty else {
                throw OAuthSessionError.missingRequiredParameter("password")
            }
            formParams.append(("username", username))
            formParams.append(("password", password))

        case .authorizationCode:
            guard let code = request.code, !code.isEmpty else {
                throw OAuthSessionError.missingRequiredParameter("code")
            }
            guard let codeVerifier = request.codeVerifier, !codeVerifier.isEmpty else {
                throw OAuthSessionError.missingRequiredParameter("codeVerifier")
            }
            formParams.append(("code", code))
            formParams.append(("code_verifier", codeVerifier))
            if let redirectURI = request.redirectURI {
                formParams.append(("redirect_uri", redirectURI.absoluteString))
            }
        }

        if let scope = request.scope, !scope.isEmpty {
            formParams.append(("scope", scope))
        }
        if let audience = request.audience, !audience.isEmpty {
            formParams.append(("audience", audience))
        }

        let urlRequest = buildTokenURLRequest(
            endpoint: request.tokenEndpoint,
            formParams: &formParams,
            clientId: request.clientId,
            clientSecret: request.clientSecret,
            useBasicAuthHeader: request.useBasicAuthHeader
        )

        let secretsToRedact: [String?] = [
            request.clientSecret,
            request.password,
            request.codeVerifier,
            request.code
        ]

        return try await executeTokenRequest(
            urlRequest,
            fallbackRefreshToken: nil,
            secretsToRedact: secretsToRedact
        )
    }

    public func refreshToken(_ request: OAuthRefreshRequest) async throws -> OAuthTokenResult {
        try Self.validateEndpointURL(request.tokenEndpoint, context: "tokenEndpoint")
        guard !request.refreshToken.isEmpty else {
            throw OAuthSessionError.missingRequiredParameter("refreshToken")
        }

        var formParams: [(String, String)] = [
            ("grant_type", "refresh_token"),
            ("refresh_token", request.refreshToken)
        ]
        if let scope = request.scope, !scope.isEmpty {
            formParams.append(("scope", scope))
        }

        let urlRequest = buildTokenURLRequest(
            endpoint: request.tokenEndpoint,
            formParams: &formParams,
            clientId: request.clientId,
            clientSecret: request.clientSecret,
            useBasicAuthHeader: request.useBasicAuthHeader
        )

        return try await executeTokenRequest(
            urlRequest,
            fallbackRefreshToken: request.refreshToken,
            secretsToRedact: [request.clientSecret, request.refreshToken]
        )
    }

    // MARK: - Private HTTP Helpers

    private nonisolated func buildTokenURLRequest(
        endpoint: URL,
        formParams: inout [(String, String)],
        clientId: String?,
        clientSecret: String?,
        useBasicAuthHeader: Bool
    ) -> URLRequest {
        var urlRequest = URLRequest(url: endpoint)
        urlRequest.httpMethod = "POST"
        urlRequest.timeoutInterval = 30
        urlRequest.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        urlRequest.setValue("application/json", forHTTPHeaderField: "Accept")

        let hasClientId = clientId.map { !$0.isEmpty } ?? false
        let hasClientSecret = clientSecret.map { !$0.isEmpty } ?? false

        if hasClientId && hasClientSecret, let clientId, let clientSecret {
            if useBasicAuthHeader {
                let credentials = Data("\(clientId):\(clientSecret)".utf8).base64EncodedString()
                urlRequest.setValue("Basic \(credentials)", forHTTPHeaderField: "Authorization")
            } else {
                formParams.append(("client_id", clientId))
                formParams.append(("client_secret", clientSecret))
            }
        } else if hasClientId, let clientId {
            formParams.append(("client_id", clientId))
        }

        urlRequest.httpBody = Data(Self.encodeFormBody(formParams).utf8)
        return urlRequest
    }

    private func executeTokenRequest(
        _ urlRequest: URLRequest,
        fallbackRefreshToken: String?,
        secretsToRedact: [String?]
    ) async throws -> OAuthTokenResult {
        let data: Data
        let response: URLResponse

        do {
            (data, response) = try await httpTransport.data(for: urlRequest)
        } catch {
            let safeReason = OAuthRedactor.redact(error.localizedDescription, secrets: secretsToRedact)
            Self.logger.error("OAuth token transport failed: \(safeReason, privacy: .private)")
            throw OAuthSessionError.transportError(reason: safeReason)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw OAuthSessionError.invalidTokenResponse(reason: "Non-HTTP response received")
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            let parsedError = Self.parseOAuthErrorBody(data, secretsToRedact: secretsToRedact)
            Self.logger.error("OAuth token endpoint returned HTTP \(httpResponse.statusCode, privacy: .public)")
            throw OAuthSessionError.httpError(
                statusCode: httpResponse.statusCode,
                oauthError: parsedError.error,
                oauthErrorDescription: parsedError.description
            )
        }

        return try parseTokenSuccessBody(
            data,
            fallbackRefreshToken: fallbackRefreshToken,
            secretsToRedact: secretsToRedact
        )
    }

    private func parseTokenSuccessBody(
        _ data: Data,
        fallbackRefreshToken: String?,
        secretsToRedact: [String?]
    ) throws -> OAuthTokenResult {
        let jsonObject: Any
        do {
            jsonObject = try JSONSerialization.jsonObject(with: data, options: [])
        } catch {
            let safeReason = OAuthRedactor.redact(error.localizedDescription, secrets: secretsToRedact)
            throw OAuthSessionError.invalidTokenResponse(reason: "Malformed JSON (\(safeReason))")
        }

        guard let dict = jsonObject as? [String: Any] else {
            throw OAuthSessionError.invalidTokenResponse(reason: "Expected JSON object")
        }

        let accessToken = (dict["access_token"] as? String) ?? (dict["token"] as? String)
        guard let accessToken, !accessToken.isEmpty else {
            throw OAuthSessionError.invalidTokenResponse(reason: "Missing access_token in response")
        }

        let refreshToken = (dict["refresh_token"] as? String)
            ?? (dict["refreshToken"] as? String)
            ?? fallbackRefreshToken

        let tokenType = (dict["token_type"] as? String)
            ?? (dict["tokenType"] as? String)
            ?? "Bearer"

        let expiresInSeconds: Double? = {
            let raw = dict["expires_in"] ?? dict["expiresIn"]
            if let num = raw as? NSNumber {
                return num.doubleValue
            }
            if let str = raw as? String, let parsed = Double(str) {
                return parsed
            }
            return nil
        }()

        let expiresAtEpochMs: Int64? = expiresInSeconds.map { seconds in
            let nowMs = Int64((nowProvider().timeIntervalSince1970 * 1000.0).rounded())
            return nowMs + Int64((seconds * 1000.0).rounded())
        }

        return OAuthTokenResult(
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresAtEpochMs: expiresAtEpochMs,
            tokenType: tokenType
        )
    }

    private nonisolated static func parseOAuthErrorBody(
        _ data: Data,
        secretsToRedact: [String?]
    ) -> (error: String?, description: String?) {
        guard !data.isEmpty,
              let dict = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] else {
            return (nil, nil)
        }
        let errorCode = (dict["error"] as? String).map {
            OAuthRedactor.redact($0, secrets: secretsToRedact)
        }
        let description = ((dict["error_description"] as? String) ?? (dict["message"] as? String)).map {
            OAuthRedactor.redact($0, secrets: secretsToRedact)
        }
        return (errorCode, description)
    }

    private nonisolated static func encodeFormBody(_ params: [(String, String)]) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-._~"))
        return params.map { key, value in
            let encodedKey = key.addingPercentEncoding(withAllowedCharacters: allowed) ?? key
            let encodedValue = value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
            return "\(encodedKey)=\(encodedValue)"
        }.joined(separator: "&")
    }
}
