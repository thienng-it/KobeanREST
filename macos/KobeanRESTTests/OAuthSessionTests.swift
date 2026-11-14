import Foundation
import XCTest
import AppKit
#if canImport(KobeanREST)
@testable import KobeanREST
#endif

// MARK: - Test Doubles

private final class MockHTTPTransport: OAuthHTTPTransport, @unchecked Sendable {
    struct RecordedRequest: Sendable {
        let url: URL?
        let method: String?
        let headers: [String: String]
        let bodyString: String
    }

    private let lock = NSLock()
    private var _requests: [RecordedRequest] = []
    private let handler: @Sendable (URLRequest) throws -> (Data, HTTPURLResponse)

    init(handler: @escaping @Sendable (URLRequest) throws -> (Data, HTTPURLResponse)) {
        self.handler = handler
    }

    var requests: [RecordedRequest] {
        lock.withLock { _requests }
    }

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        let bodyString = request.httpBody.flatMap { String(data: $0, encoding: .utf8) } ?? ""
        let recorded = RecordedRequest(
            url: request.url,
            method: request.httpMethod,
            headers: request.allHTTPHeaderFields ?? [:],
            bodyString: bodyString
        )
        lock.withLock {
            _requests.append(recorded)
        }
        return try handler(request)
    }
}

@MainActor
private final class MockWebAuthSessionRunner: OAuthWebAuthSessionRunner {
    struct Invocation {
        let url: URL
        let callbackURLScheme: String
        let prefersEphemeralWebBrowserSession: Bool
    }

    private(set) var invocations: [Invocation] = []
    private let handler: @MainActor (URL, String, Bool) throws -> URL

    init(handler: @escaping @MainActor (URL, String, Bool) throws -> URL) {
        self.handler = handler
    }

    func authenticate(
        url: URL,
        callbackURLScheme: String,
        prefersEphemeralWebBrowserSession: Bool,
        presentationAnchor: NSWindow?
    ) async throws -> URL {
        invocations.append(
            Invocation(
                url: url,
                callbackURLScheme: callbackURLScheme,
                prefersEphemeralWebBrowserSession: prefersEphemeralWebBrowserSession
            )
        )
        return try handler(url, callbackURLScheme, prefersEphemeralWebBrowserSession)
    }
}

// MARK: - Helpers

private func makeHTTPResponse(url: URL, statusCode: Int) -> HTTPURLResponse {
    HTTPURLResponse(
        url: url,
        statusCode: statusCode,
        httpVersion: "HTTP/1.1",
        headerFields: ["Content-Type": "application/json"]
    )!
}

private func parseFormBody(_ body: String) -> [String: String] {
    var result: [String: String] = [:]
    for pair in body.split(separator: "&") {
        let parts = pair.split(separator: "=", maxSplits: 1, omittingEmptySubsequences: false)
        guard parts.count == 2 else { continue }
        let key = String(parts[0]).removingPercentEncoding ?? String(parts[0])
        let value = String(parts[1]).removingPercentEncoding ?? String(parts[1])
        result[key] = value
    }
    return result
}

// MARK: - Tests

final class OAuthSessionTests: XCTestCase {

    // MARK: PKCE & State Generation

    func testPKCEChallengeMatchesRFC7636TestVector() {
        // RFC 7636 Appendix B test vector
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
        let expectedChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

        let actualChallenge = OAuthSessionService.codeChallengeS256(for: verifier)
        XCTAssertEqual(actualChallenge, expectedChallenge)
    }

    func testGeneratePKCEPairAndStateFormatAndUniqueness() throws {
        let pair1 = try OAuthSessionService.generatePKCEPair()
        let pair2 = try OAuthSessionService.generatePKCEPair()

        XCTAssertEqual(pair1.codeChallengeMethod, "S256")
        XCTAssertEqual(pair1.codeVerifier.count, 43)
        XCTAssertEqual(pair1.codeChallenge, OAuthSessionService.codeChallengeS256(for: pair1.codeVerifier))
        XCTAssertNotEqual(pair1.codeVerifier, pair2.codeVerifier)
        XCTAssertNotEqual(pair1.codeChallenge, pair2.codeChallenge)

        let allowedSet = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")
        XCTAssertTrue(pair1.codeVerifier.unicodeScalars.allSatisfy { allowedSet.contains($0) })
        XCTAssertTrue(pair1.codeChallenge.unicodeScalars.allSatisfy { allowedSet.contains($0) })

        let state1 = try OAuthSessionService.generateState()
        let state2 = try OAuthSessionService.generateState()
        XCTAssertEqual(state1.count, 43)
        XCTAssertNotEqual(state1, state2)
        XCTAssertTrue(state1.unicodeScalars.allSatisfy { allowedSet.contains($0) })
    }

    func testBuildAuthorizationURLIncludesPKCEAndState() throws {
        let authEndpoint = URL(string: "https://auth.example.com/oauth/authorize")!
        let redirectURI = URL(string: "kobeanrest://oauth/callback")!
        let pkce = OAuthPKCEPair(
            codeVerifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
            codeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        )

        let request = OAuthAuthorizationRequest(
            authorizationEndpoint: authEndpoint,
            clientId: "client-123",
            redirectURI: redirectURI,
            scope: "read write",
            audience: "https://api.example.com",
            state: "csrf-state-xyz",
            pkce: pkce,
            extraQueryParameters: [
                "prompt": "consent",
                // Attempting to overwrite security parameters must be ignored
                "state": "forged-state",
                "code_challenge": "forged-challenge"
            ]
        )

        let builtURL = try request.buildAuthorizationURL()
        let components = URLComponents(url: builtURL, resolvingAgainstBaseURL: false)
        let query = Dictionary(
            (components?.queryItems ?? []).map { ($0.name, $0.value ?? "") },
            uniquingKeysWith: { first, _ in first }
        )

        XCTAssertEqual(query["response_type"], "code")
        XCTAssertEqual(query["client_id"], "client-123")
        XCTAssertEqual(query["redirect_uri"], "kobeanrest://oauth/callback")
        XCTAssertEqual(query["state"], "csrf-state-xyz")
        XCTAssertEqual(query["code_challenge"], "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")
        XCTAssertEqual(query["code_challenge_method"], "S256")
        XCTAssertEqual(query["scope"], "read write")
        XCTAssertEqual(query["audience"], "https://api.example.com")
        XCTAssertEqual(query["prompt"], "consent")
    }

    // MARK: Callback Parser (T-01 Fail-Closed Validation)

    func testCallbackParserAcceptsMatchingStateAndExtractsCode() throws {
        let redirectURI = URL(string: "kobeanrest://oauth/callback")!
        let callbackURL = URL(string: "KobeanREST://oauth/callback?code=auth_code_abc&state=expected_state_123")!

        let parsed = try OAuthSessionService.parseCallbackURL(
            callbackURL,
            expectedScheme: "kobeanrest",
            expectedState: "expected_state_123",
            expectedRedirectURI: redirectURI
        )

        XCTAssertEqual(parsed.code, "auth_code_abc")
        XCTAssertEqual(parsed.state, "expected_state_123")
    }

    func testCallbackParserFailsClosedOnMismatchedState() {
        let callbackURL = URL(string: "kobeanrest://oauth/callback?code=auth_code_abc&state=attacker_state")!

        XCTAssertThrowsError(
            try OAuthSessionService.parseCallbackURL(
                callbackURL,
                expectedScheme: "kobeanrest",
                expectedState: "expected_state_123"
            )
        ) { error in
            XCTAssertEqual(error as? OAuthSessionError, .stateMismatch)
        }
    }

    func testCallbackParserFailsClosedOnMissingOrEmptyState() {
        let missingStateURL = URL(string: "kobeanrest://oauth/callback?code=auth_code_abc")!
        XCTAssertThrowsError(
            try OAuthSessionService.parseCallbackURL(
                missingStateURL,
                expectedScheme: "kobeanrest",
                expectedState: "expected_state_123"
            )
        ) { error in
            XCTAssertEqual(error as? OAuthSessionError, .missingState)
        }

        let emptyStateURL = URL(string: "kobeanrest://oauth/callback?code=auth_code_abc&state=")!
        XCTAssertThrowsError(
            try OAuthSessionService.parseCallbackURL(
                emptyStateURL,
                expectedScheme: "kobeanrest",
                expectedState: "expected_state_123"
            )
        ) { error in
            XCTAssertEqual(error as? OAuthSessionError, .missingState)
        }

        // HTTP Parameter Pollution: duplicate state params must fail closed
        let duplicateStateURL = URL(string: "kobeanrest://oauth/callback?code=auth_code_abc&state=expected_state_123&state=forged")!
        XCTAssertThrowsError(
            try OAuthSessionService.parseCallbackURL(
                duplicateStateURL,
                expectedScheme: "kobeanrest",
                expectedState: "expected_state_123"
            )
        ) { error in
            XCTAssertEqual(error as? OAuthSessionError, .stateMismatch)
        }
    }

    func testCallbackParserFailsClosedOnMismatchedSchemeOrRedirectURI() {
        let wrongSchemeURL = URL(string: "evilscheme://oauth/callback?code=auth_code_abc&state=expected_state_123")!
        XCTAssertThrowsError(
            try OAuthSessionService.parseCallbackURL(
                wrongSchemeURL,
                expectedScheme: "kobeanrest",
                expectedState: "expected_state_123"
            )
        ) { error in
            XCTAssertEqual(
                error as? OAuthSessionError,
                .invalidCallbackScheme(expected: "kobeanrest", actual: "evilscheme")
            )
        }

        let expectedRedirect = URL(string: "kobeanrest://oauth/callback")!
        let wrongPathURL = URL(string: "kobeanrest://oauth/other?code=auth_code_abc&state=expected_state_123")!
        XCTAssertThrowsError(
            try OAuthSessionService.parseCallbackURL(
                wrongPathURL,
                expectedScheme: "kobeanrest",
                expectedState: "expected_state_123",
                expectedRedirectURI: expectedRedirect
            )
        ) { error in
            XCTAssertEqual(error as? OAuthSessionError, .invalidCallbackRedirectURI)
        }
    }

    func testCallbackParserFailsClosedOnOAuthErrorParam() {
        let errorWithStateURL = URL(
            string: "kobeanrest://oauth/callback?error=access_denied&error_description=User%20denied%20access&state=expected_state_123"
        )!
        XCTAssertThrowsError(
            try OAuthSessionService.parseCallbackURL(
                errorWithStateURL,
                expectedScheme: "kobeanrest",
                expectedState: "expected_state_123"
            )
        ) { error in
            XCTAssertEqual(
                error as? OAuthSessionError,
                .providerError(error: "access_denied", description: "User denied access")
            )
        }

        let missingCodeURL = URL(string: "kobeanrest://oauth/callback?state=expected_state_123")!
        XCTAssertThrowsError(
            try OAuthSessionService.parseCallbackURL(
                missingCodeURL,
                expectedScheme: "kobeanrest",
                expectedState: "expected_state_123"
            )
        ) { error in
            XCTAssertEqual(error as? OAuthSessionError, .missingAuthorizationCode)
        }
    }

    // MARK: Token Exchange & Refresh Flows

    func testAuthorizationCodeTokenExchangeWithPKCEAndMockTransport() async throws {
        let tokenURL = URL(string: "https://auth.example.com/oauth/token")!
        let redirectURI = URL(string: "kobeanrest://oauth/callback")!
        let fixedNow = Date(timeIntervalSince1970: 1_700_000_000)

        let transport = MockHTTPTransport { request in
            let json = """
            {
              "access_token": "tok_access_123",
              "refresh_token": "tok_refresh_456",
              "expires_in": 3600,
              "token_type": "Bearer"
            }
            """.data(using: .utf8)!
            return (json, makeHTTPResponse(url: request.url!, statusCode: 200))
        }

        let service = await MainActor.run {
            OAuthSessionService(
                httpTransport: transport,
                nowProvider: { fixedNow }
            )
        }

        let request = OAuthTokenRequest.authorizationCode(
            tokenEndpoint: tokenURL,
            code: "auth_code_999",
            redirectURI: redirectURI,
            codeVerifier: "verifier_secret_value_abc12345678901234567890",
            clientId: "public-client-id",
            clientSecret: nil
        )

        let result = try await service.exchangeToken(request)
        XCTAssertEqual(result.accessToken, "tok_access_123")
        XCTAssertEqual(result.refreshToken, "tok_refresh_456")
        XCTAssertEqual(result.tokenType, "Bearer")
        XCTAssertEqual(result.expiresAtEpochMs, 1_700_003_600_000)

        XCTAssertEqual(transport.requests.count, 1)
        let recorded = transport.requests[0]
        XCTAssertEqual(recorded.method, "POST")
        XCTAssertEqual(recorded.headers["Content-Type"], "application/x-www-form-urlencoded")

        let form = parseFormBody(recorded.bodyString)
        XCTAssertEqual(form["grant_type"], "authorization_code")
        XCTAssertEqual(form["code"], "auth_code_999")
        XCTAssertEqual(form["redirect_uri"], "kobeanrest://oauth/callback")
        XCTAssertEqual(form["code_verifier"], "verifier_secret_value_abc12345678901234567890")
        XCTAssertEqual(form["client_id"], "public-client-id")
        XCTAssertNil(form["client_secret"])
    }

    func testClientCredentialsFlowWithMockTransport() async throws {
        let tokenURL = URL(string: "https://auth.example.com/oauth/token")!
        let fixedNow = Date(timeIntervalSince1970: 1_700_000_000)

        let transport = MockHTTPTransport { request in
            let json = """
            {
              "access_token": "cc_access_token",
              "expires_in": 1800,
              "token_type": "Bearer"
            }
            """.data(using: .utf8)!
            return (json, makeHTTPResponse(url: request.url!, statusCode: 200))
        }

        let service = await MainActor.run {
            OAuthSessionService(
                httpTransport: transport,
                nowProvider: { fixedNow }
            )
        }

        let request = OAuthTokenRequest.clientCredentials(
            tokenEndpoint: tokenURL,
            clientId: "svc-client",
            clientSecret: "super-secret-xyz",
            scope: "api.read",
            audience: "https://api.example.com"
        )

        let result = try await service.exchangeToken(request)
        XCTAssertEqual(result.accessToken, "cc_access_token")
        XCTAssertNil(result.refreshToken)
        XCTAssertEqual(result.tokenType, "Bearer")
        XCTAssertEqual(result.expiresAtEpochMs, 1_700_001_800_000)

        let recorded = transport.requests[0]
        let expectedBasic = Data("svc-client:super-secret-xyz".utf8).base64EncodedString()
        XCTAssertEqual(recorded.headers["Authorization"], "Basic \(expectedBasic)")

        let form = parseFormBody(recorded.bodyString)
        XCTAssertEqual(form["grant_type"], "client_credentials")
        XCTAssertEqual(form["scope"], "api.read")
        XCTAssertEqual(form["audience"], "https://api.example.com")
        XCTAssertNil(form["client_secret"])
    }

    func testPasswordCredentialsFlowWithMockTransport() async throws {
        let tokenURL = URL(string: "https://auth.example.com/oauth/token")!

        let transport = MockHTTPTransport { request in
            let json = """
            {
              "access_token": "pw_access_token",
              "refresh_token": "pw_refresh_token",
              "token_type": "Bearer"
            }
            """.data(using: .utf8)!
            return (json, makeHTTPResponse(url: request.url!, statusCode: 200))
        }

        let service = await MainActor.run {
            OAuthSessionService(httpTransport: transport)
        }

        let request = OAuthTokenRequest.passwordCredentials(
            tokenEndpoint: tokenURL,
            username: "alice@example.com",
            password: "alice-password-!@#",
            clientId: "app-id",
            clientSecret: "app-secret",
            scope: "openid"
        )

        let result = try await service.exchangeToken(request)
        XCTAssertEqual(result.accessToken, "pw_access_token")
        XCTAssertEqual(result.refreshToken, "pw_refresh_token")
        XCTAssertEqual(result.tokenType, "Bearer")

        let form = parseFormBody(transport.requests[0].bodyString)
        XCTAssertEqual(form["grant_type"], "password")
        XCTAssertEqual(form["username"], "alice@example.com")
        XCTAssertEqual(form["password"], "alice-password-!@#")
        XCTAssertEqual(form["scope"], "openid")
    }

    func testRefreshTokenFlowAndPreservesPreviousRefreshTokenWhenOmitted() async throws {
        let tokenURL = URL(string: "https://auth.example.com/oauth/token")!
        let fixedNow = Date(timeIntervalSince1970: 1_700_000_000)

        let transport = MockHTTPTransport { request in
            let json = """
            {
              "access_token": "new_access_token",
              "expires_in": 900,
              "token_type": "mac"
            }
            """.data(using: .utf8)!
            return (json, makeHTTPResponse(url: request.url!, statusCode: 200))
        }

        let service = await MainActor.run {
            OAuthSessionService(
                httpTransport: transport,
                nowProvider: { fixedNow }
            )
        }

        let refreshRequest = OAuthRefreshRequest(
            tokenEndpoint: tokenURL,
            refreshToken: "existing_refresh_token_123",
            clientId: "client-id",
            clientSecret: "client-secret",
            scope: "read"
        )

        let result = try await service.refreshToken(refreshRequest)
        XCTAssertEqual(result.accessToken, "new_access_token")
        XCTAssertEqual(result.refreshToken, "existing_refresh_token_123")
        XCTAssertEqual(result.tokenType, "mac")
        XCTAssertEqual(result.expiresAtEpochMs, 1_700_000_900_000)

        let form = parseFormBody(transport.requests[0].bodyString)
        XCTAssertEqual(form["grant_type"], "refresh_token")
        XCTAssertEqual(form["refresh_token"], "existing_refresh_token_123")
        XCTAssertEqual(form["scope"], "read")
    }

    // MARK: Secret & Verifier Redaction in Errors and Descriptions

    func testErrorsAndDescriptionsNeverLeakSecretsOrCodeVerifier() async {
        let tokenURL = URL(string: "https://auth.example.com/oauth/token")!
        let redirectURI = URL(string: "kobeanrest://oauth/callback")!
        let secretVerifier = "secret_pkce_verifier_value_do_not_leak_0123456789"
        let clientSecret = "super_secret_client_value_do_not_leak"

        let transport = MockHTTPTransport { request in
            let errorJSON = """
            {
              "error": "invalid_grant",
              "error_description": "Bad verifier \(secretVerifier) for secret \(clientSecret)"
            }
            """.data(using: .utf8)!
            return (errorJSON, makeHTTPResponse(url: request.url!, statusCode: 400))
        }

        let service = await MainActor.run {
            OAuthSessionService(httpTransport: transport)
        }

        let tokenRequest = OAuthTokenRequest.authorizationCode(
            tokenEndpoint: tokenURL,
            code: "code-123",
            redirectURI: redirectURI,
            codeVerifier: secretVerifier,
            clientId: "client-123",
            clientSecret: clientSecret
        )

        // Ensure request description itself redacts secrets and verifier
        let requestDescription = String(reflecting: tokenRequest)
        XCTAssertFalse(requestDescription.contains(secretVerifier))
        XCTAssertFalse(requestDescription.contains(clientSecret))

        do {
            _ = try await service.exchangeToken(tokenRequest)
            XCTFail("Expected token exchange to fail with HTTP 400")
        } catch let error as OAuthSessionError {
            let localized = error.localizedDescription
            let described = String(describing: error)
            let debugDescribed = String(reflecting: error)

            for text in [localized, described, debugDescribed] {
                XCTAssertFalse(text.contains(secretVerifier), "Error leaked code_verifier: \(text)")
                XCTAssertFalse(text.contains(clientSecret), "Error leaked client_secret: \(text)")
                XCTAssertTrue(text.contains("[redacted]"), "Expected redacted placeholder in: \(text)")
            }
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }

        // Also verify OAuthPKCEPair and OAuthTokenResult descriptions redact sensitive values
        let pkce = OAuthPKCEPair(codeVerifier: secretVerifier, codeChallenge: "challenge-ok")
        XCTAssertFalse(String(describing: pkce).contains(secretVerifier))
        XCTAssertFalse(String(reflecting: pkce).contains(secretVerifier))

        let tokenResult = OAuthTokenResult(
            accessToken: "leak_guard_access_token",
            refreshToken: "leak_guard_refresh_token",
            expiresAtEpochMs: 1_700_003_600_000,
            tokenType: "Bearer"
        )
        XCTAssertFalse(String(describing: tokenResult).contains("leak_guard_access_token"))
        XCTAssertFalse(String(describing: tokenResult).contains("leak_guard_refresh_token"))
        XCTAssertFalse(String(reflecting: tokenResult).contains("leak_guard_access_token"))
        XCTAssertFalse(String(reflecting: tokenResult).contains("leak_guard_refresh_token"))
    }

    // MARK: End-to-End ASWebAuthenticationSession Coordinator Flow

    @MainActor
    func testAuthorizeAndExchangeUsesEphemeralSessionAndValidatesStateAndVerifier() async throws {
        let authEndpoint = URL(string: "https://auth.example.com/authorize")!
        let tokenEndpoint = URL(string: "https://auth.example.com/token")!
        let redirectURI = URL(string: "kobeanrest://oauth/callback")!

        let mockRunner = MockWebAuthSessionRunner { url, scheme, ephemeral in
            XCTAssertEqual(scheme, "kobeanrest")
            XCTAssertTrue(ephemeral)
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            let state = components?.queryItems?.first(where: { $0.name == "state" })?.value ?? ""
            let challenge = components?.queryItems?.first(where: { $0.name == "code_challenge" })?.value ?? ""
            XCTAssertFalse(state.isEmpty)
            XCTAssertFalse(challenge.isEmpty)
            return URL(string: "kobeanrest://oauth/callback?code=web_auth_code&state=\(state)")!
        }

        let transport = MockHTTPTransport { request in
            let json = """
            {
              "access_token": "final_access_token",
              "refresh_token": "final_refresh_token",
              "expires_in": 7200,
              "token_type": "Bearer"
            }
            """.data(using: .utf8)!
            return (json, makeHTTPResponse(url: request.url!, statusCode: 200))
        }

        let service = OAuthSessionService(
            prefersEphemeralWebBrowserSession: true,
            webAuthRunner: mockRunner,
            httpTransport: transport
        )

        let result = try await service.authorizeAndExchangeCode(
            authorizationEndpoint: authEndpoint,
            tokenEndpoint: tokenEndpoint,
            clientId: "native-macos-client",
            clientSecret: nil,
            redirectURI: redirectURI,
            scope: "profile email",
            audience: nil,
            presentationAnchor: nil
        )

        XCTAssertEqual(result.accessToken, "final_access_token")
        XCTAssertEqual(result.refreshToken, "final_refresh_token")
        XCTAssertEqual(mockRunner.invocations.count, 1)
        XCTAssertEqual(transport.requests.count, 1)

        // Verify the sent code_verifier hashes to the code_challenge from the auth URL
        let authURLComponents = URLComponents(url: mockRunner.invocations[0].url, resolvingAgainstBaseURL: false)
        let sentChallenge = authURLComponents?.queryItems?.first(where: { $0.name == "code_challenge" })?.value
        let form = parseFormBody(transport.requests[0].bodyString)
        let sentVerifier = form["code_verifier"] ?? ""
        XCTAssertEqual(OAuthSessionService.codeChallengeS256(for: sentVerifier), sentChallenge)
    }

    @MainActor
    func testAuthorizeRespectsNonEphemeralConfigurationAndRejectsEmptyVerifier() async throws {
        let authEndpoint = URL(string: "https://auth.example.com/authorize")!
        let tokenEndpoint = URL(string: "https://auth.example.com/token")!
        let redirectURI = URL(string: "kobeanrest://oauth/callback")!

        let mockRunner = MockWebAuthSessionRunner { url, _, ephemeral in
            XCTAssertFalse(ephemeral)
            let state = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "state" })?.value ?? ""
            return URL(string: "kobeanrest://oauth/callback?code=code_ok&state=\(state)")!
        }

        let transport = MockHTTPTransport { request in
            let json = #"{"access_token":"tok_ok"}"#.data(using: .utf8)!
            return (json, makeHTTPResponse(url: request.url!, statusCode: 200))
        }

        let service = OAuthSessionService(
            prefersEphemeralWebBrowserSession: false,
            webAuthRunner: mockRunner,
            httpTransport: transport
        )

        let (callback, _) = try await service.authorize(
            authorizationEndpoint: authEndpoint,
            clientId: "client-1",
            redirectURI: redirectURI
        )
        XCTAssertEqual(callback.code, "code_ok")
        XCTAssertEqual(mockRunner.invocations.first?.prefersEphemeralWebBrowserSession, false)

        let emptyVerifierRequest = OAuthTokenRequest.authorizationCode(
            tokenEndpoint: tokenEndpoint,
            code: "code_ok",
            redirectURI: redirectURI,
            codeVerifier: "",
            clientId: "client-1"
        )
        do {
            _ = try await service.exchangeToken(emptyVerifierRequest)
            XCTFail("Expected empty codeVerifier to fail closed")
        } catch let error as OAuthSessionError {
            XCTAssertEqual(error, .missingRequiredParameter("codeVerifier"))
        }
    }

    @MainActor
    func testEndpointSchemeValidationAllowsHttpsAndLoopbackHttpAndRejectsInsecureOrNonHttpBeforeExecution() async throws {
        let mockRunner = MockWebAuthSessionRunner { url, _, _ in
            let state = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "state" })?.value ?? ""
            return URL(string: "kobeanrest://oauth/callback?code=code_ok&state=\(state)")!
        }

        let transport = MockHTTPTransport { request in
            let json = #"{"access_token":"tok_loopback"}"#.data(using: .utf8)!
            return (json, makeHTTPResponse(url: request.url!, statusCode: 200))
        }

        let service = OAuthSessionService(
            webAuthRunner: mockRunner,
            httpTransport: transport
        )
        let redirectURI = URL(string: "kobeanrest://oauth/callback")!

        // Reject plain HTTP on non-loopback authorizationEndpoint before opening ASWebAuthenticationSession
        do {
            _ = try await service.authorizeAndExchangeCode(
                authorizationEndpoint: URL(string: "http://auth.example.com/authorize")!,
                tokenEndpoint: URL(string: "https://auth.example.com/token")!,
                clientId: "client-1",
                redirectURI: redirectURI
            )
            XCTFail("Expected insecure authorizationEndpoint to fail")
        } catch let error as OAuthSessionError {
            XCTAssertEqual(error, .invalidURL("authorizationEndpoint"))
        }
        XCTAssertTrue(mockRunner.invocations.isEmpty)
        XCTAssertTrue(transport.requests.isEmpty)

        // Reject plain HTTP on non-loopback tokenEndpoint before opening ASWebAuthenticationSession
        do {
            _ = try await service.authorizeAndExchangeCode(
                authorizationEndpoint: URL(string: "https://auth.example.com/authorize")!,
                tokenEndpoint: URL(string: "http://auth.example.com/token")!,
                clientId: "client-1",
                redirectURI: redirectURI
            )
            XCTFail("Expected insecure tokenEndpoint to fail")
        } catch let error as OAuthSessionError {
            XCTAssertEqual(error, .invalidURL("tokenEndpoint"))
        }
        XCTAssertTrue(mockRunner.invocations.isEmpty)
        XCTAssertTrue(transport.requests.isEmpty)

        // Reject non-HTTP(S) schemes before calling transport
        for badURL in ["javascript:alert(1)", "file:///etc/passwd", "ftp://auth.example.com/token"] {
            do {
                _ = try await service.exchangeToken(
                    .clientCredentials(
                        tokenEndpoint: URL(string: badURL)!,
                        clientId: "client-1",
                        clientSecret: "secret"
                    )
                )
                XCTFail("Expected scheme \(badURL) to be rejected")
            } catch let error as OAuthSessionError {
                XCTAssertEqual(error, .invalidURL("tokenEndpoint"))
            }
        }
        XCTAssertTrue(transport.requests.isEmpty)

        // Reject insecure HTTP refreshToken endpoint
        do {
            _ = try await service.refreshToken(
                OAuthRefreshRequest(
                    tokenEndpoint: URL(string: "http://auth.example.com/token")!,
                    refreshToken: "refresh-123"
                )
            )
            XCTFail("Expected insecure refresh tokenEndpoint to be rejected")
        } catch let error as OAuthSessionError {
            XCTAssertEqual(error, .invalidURL("tokenEndpoint"))
        }
        XCTAssertTrue(transport.requests.isEmpty)

        // Allow loopback HTTP hosts (localhost, 127.0.0.1, [::1])
        for loopback in ["http://localhost:8080/token", "http://127.0.0.1:8080/token", "http://[::1]:8080/token"] {
            let result = try await service.exchangeToken(
                .clientCredentials(
                    tokenEndpoint: URL(string: loopback)!,
                    clientId: "client-1",
                    clientSecret: nil
                )
            )
            XCTAssertEqual(result.accessToken, "tok_loopback")
        }
        XCTAssertEqual(transport.requests.count, 3)
    }
}
