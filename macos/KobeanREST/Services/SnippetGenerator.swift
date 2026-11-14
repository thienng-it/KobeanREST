import Foundation

/// Supported target languages and CLI tools for generated request snippets.
public enum SnippetLanguage: String, Sendable, CaseIterable, Identifiable, Equatable, Hashable {
    case curl
    case swiftURLSession
    case javascriptFetch
    case pythonRequests
    case httpie
    case goNetHttp

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .curl:
            return "cURL"
        case .swiftURLSession:
            return "Swift (URLSession)"
        case .javascriptFetch:
            return "JavaScript (fetch)"
        case .pythonRequests:
            return "Python (requests)"
        case .httpie:
            return "HTTPie"
        case .goNetHttp:
            return "Go (net/http)"
        }
    }
}

/// Standalone request description mapped from UI or model state without coupling to app models.
public struct SnippetRequestInput: Sendable {
    public let method: String
    public let url: String
    public let headers: [(key: String, value: String, enabled: Bool)]
    public let body: String?
    public let bodyMimeType: String?

    public init(
        method: String,
        url: String,
        headers: [(key: String, value: String, enabled: Bool)] = [],
        body: String? = nil,
        bodyMimeType: String? = nil
    ) {
        self.method = method
        self.url = url
        self.headers = headers
        self.body = body
        self.bodyMimeType = bodyMimeType
    }
}

/// Generates copy-safe, injection-resistant HTTP request code snippets.
public enum SnippetGenerator: Sendable {
    public static let redactedPlaceholder = "<REDACTED>"

    private static let sensitiveHeaderNames: Set<String> = [
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

    private static let sensitiveHeaderSegments: Set<String> = [
        "secret",
        "password",
        "passwd",
        "token",
        "apikey",
        "credential",
        "credentials",
    ]

    private static let sensitiveQueryParamNames: Set<String> = [
        "token",
        "api_key",
        "apikey",
        "access_token",
        "secret",
        "client_secret",
    ]

    private enum StringLiteralFlavor {
        case swift
        case javascript
        case python
        case go
    }

    private struct ResolvedRequest {
        let method: String
        let url: String
        let headers: [(key: String, value: String)]
        let body: String?
    }

    /// Generates a request snippet for the specified language.
    /// Sensitive headers are redacted by default so copied/shared snippets do not leak secrets.
    public static func generate(
        _ input: SnippetRequestInput,
        language: SnippetLanguage,
        redactSensitiveHeaders: Bool = true,
        includeEmptyBody: Bool = false
    ) -> String {
        let resolved = resolve(
            input,
            redactSensitiveHeaders: redactSensitiveHeaders,
            includeEmptyBody: includeEmptyBody
        )

        switch language {
        case .curl:
            return renderCurl(resolved)
        case .swiftURLSession:
            return renderSwiftURLSession(resolved)
        case .javascriptFetch:
            return renderJavaScriptFetch(resolved)
        case .pythonRequests:
            return renderPythonRequests(resolved)
        case .httpie:
            return renderHTTPie(resolved)
        case .goNetHttp:
            return renderGoNetHttp(resolved)
        }
    }

    /// Returns true if the header name commonly carries credentials, tokens, or secrets.
    public static func isSensitiveHeader(_ name: String) -> Bool {
        let normalized = name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if sensitiveHeaderNames.contains(normalized) {
            return true
        }
        let segments = normalized.split { $0 == "-" || $0 == "_" }.map(String.init)
        return segments.contains { sensitiveHeaderSegments.contains($0) }
    }

    /// Wraps a value in POSIX single quotes, escaping embedded single quotes as `'\''`.
    public static func shellSingleQuote(_ value: String) -> String {
        "'" + value.replacingOccurrences(of: "'", with: "'\\''") + "'"
    }

    // MARK: - Resolution

    private static func resolve(
        _ input: SnippetRequestInput,
        redactSensitiveHeaders: Bool,
        includeEmptyBody: Bool
    ) -> ResolvedRequest {
        let method = sanitizeMethod(input.method)
        let trimmedURL = input.url.trimmingCharacters(in: .whitespacesAndNewlines)
        let url = redactSensitiveHeaders ? redactSensitiveQueryParams(in: trimmedURL) : trimmedURL

        let effectiveBody: String?
        if let body = input.body, (!body.isEmpty || includeEmptyBody) {
            effectiveBody = body
        } else {
            effectiveBody = nil
        }

        var headers: [(key: String, value: String)] = []
        var hasContentType = false

        for header in input.headers where header.enabled {
            let key = header.key.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !key.isEmpty else { continue }
            if key.caseInsensitiveCompare("content-type") == .orderedSame {
                hasContentType = true
            }
            let value = (redactSensitiveHeaders && isSensitiveHeader(key))
                ? redactedPlaceholder
                : header.value
            headers.append((key: key, value: value))
        }

        if effectiveBody != nil, !hasContentType,
           let mime = input.bodyMimeType?.trimmingCharacters(in: .whitespacesAndNewlines),
           !mime.isEmpty {
            headers.append((key: "Content-Type", value: mime))
        }

        return ResolvedRequest(
            method: method,
            url: url,
            headers: headers,
            body: effectiveBody
        )
    }

    private static func redactSensitiveQueryParams(in rawURL: String) -> String {
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
            if sensitiveQueryParamNames.contains(decodedKey) {
                changed = true
                return "\(rawKey)=\(redactedPlaceholder)"
            }
            return pair
        }

        guard changed else { return rawURL }
        return "\(base)?\(sanitizedPairs.joined(separator: "&"))\(hash)"
    }

    private static func sanitizeMethod(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let token = trimmed.prefix { ch in
            ch.isASCII && (ch.isLetter || ch.isNumber || ch == "-" || ch == "_")
        }
        let upper = String(token).uppercased()
        return upper.isEmpty ? "GET" : upper
    }

    // MARK: - Language Renderers

    private static func renderCurl(_ request: ResolvedRequest) -> String {
        var parts = ["curl -X \(request.method) -- \(shellSingleQuote(request.url))"]
        for header in request.headers {
            parts.append("-H \(shellSingleQuote("\(header.key): \(header.value)"))")
        }
        if let body = request.body {
            parts.append("--data-raw \(shellSingleQuote(body))")
        }
        return joinShellLines(parts)
    }

    private static func renderHTTPie(_ request: ResolvedRequest) -> String {
        var parts = ["http \(request.method) -- \(shellSingleQuote(request.url))"]
        for header in request.headers {
            parts.append(shellSingleQuote("\(header.key):\(header.value)"))
        }
        if let body = request.body {
            parts.append("--raw \(shellSingleQuote(body))")
        }
        return joinShellLines(parts)
    }

    private static func joinShellLines(_ parts: [String]) -> String {
        guard parts.count > 1 else { return parts[0] }
        return parts.enumerated().map { index, part in
            let prefix = index == 0 ? "" : "  "
            let suffix = index == parts.count - 1 ? "" : " \\"
            return prefix + part + suffix
        }.joined(separator: "\n")
    }

    private static func renderSwiftURLSession(_ request: ResolvedRequest) -> String {
        var lines: [String] = [
            "import Foundation",
            "",
            "guard let url = URL(string: \(quoteStringLiteral(request.url, flavor: .swift))) else {",
            "    fatalError(\"Invalid URL\")",
            "}",
            "var request = URLRequest(url: url)",
            "request.httpMethod = \(quoteStringLiteral(request.method, flavor: .swift))",
        ]

        for header in request.headers {
            let valueLiteral = quoteStringLiteral(header.value, flavor: .swift)
            let keyLiteral = quoteStringLiteral(header.key, flavor: .swift)
            lines.append("request.setValue(\(valueLiteral), forHTTPHeaderField: \(keyLiteral))")
        }

        if let body = request.body {
            lines.append("request.httpBody = Data(\(quoteStringLiteral(body, flavor: .swift)).utf8)")
        }

        lines.append("")
        lines.append("let (data, response) = try await URLSession.shared.data(for: request)")
        return lines.joined(separator: "\n")
    }

    private static func renderJavaScriptFetch(_ request: ResolvedRequest) -> String {
        var optionLines = ["  method: \(quoteStringLiteral(request.method, flavor: .javascript)),"]

        if !request.headers.isEmpty {
            optionLines.append("  headers: {")
            for header in request.headers {
                let keyLiteral = quoteStringLiteral(header.key, flavor: .javascript)
                let valueLiteral = quoteStringLiteral(header.value, flavor: .javascript)
                optionLines.append("    \(keyLiteral): \(valueLiteral),")
            }
            optionLines.append("  },")
        }

        if let body = request.body {
            optionLines.append("  body: \(quoteStringLiteral(body, flavor: .javascript)),")
        }

        var lines = ["const response = await fetch(\(quoteStringLiteral(request.url, flavor: .javascript)), {"]
        lines.append(contentsOf: optionLines)
        lines.append("});")
        lines.append("")
        lines.append("const data = await response.text();")
        return lines.joined(separator: "\n")
    }

    private static func renderPythonRequests(_ request: ResolvedRequest) -> String {
        var lines: [String] = [
            "import requests",
            "",
            "url = \(quoteStringLiteral(request.url, flavor: .python))",
        ]

        var callArgs = [
            quoteStringLiteral(request.method, flavor: .python),
            "url",
        ]

        if !request.headers.isEmpty {
            lines.append("headers = {")
            for header in request.headers {
                let keyLiteral = quoteStringLiteral(header.key, flavor: .python)
                let valueLiteral = quoteStringLiteral(header.value, flavor: .python)
                lines.append("    \(keyLiteral): \(valueLiteral),")
            }
            lines.append("}")
            callArgs.append("headers=headers")
        }

        if let body = request.body {
            lines.append("payload = \(quoteStringLiteral(body, flavor: .python))")
            callArgs.append("data=payload.encode(\"utf-8\")")
        }

        lines.append("")
        lines.append("response = requests.request(\(callArgs.joined(separator: ", ")))")
        lines.append("print(response.text)")
        return lines.joined(separator: "\n")
    }

    private static func renderGoNetHttp(_ request: ResolvedRequest) -> String {
        var imports = [
            "\t\"fmt\"",
            "\t\"io\"",
            "\t\"net/http\"",
        ]
        if request.body != nil {
            imports.append("\t\"strings\"")
        }

        var lines: [String] = [
            "package main",
            "",
            "import (",
        ]
        lines.append(contentsOf: imports)
        lines.append(contentsOf: [
            ")",
            "",
            "func main() {",
            "\turl := \(quoteStringLiteral(request.url, flavor: .go))",
        ])

        let bodyArg: String
        if let body = request.body {
            lines.append("\tpayload := strings.NewReader(\(quoteStringLiteral(body, flavor: .go)))")
            bodyArg = "payload"
        } else {
            bodyArg = "nil"
        }

        lines.append(contentsOf: [
            "",
            "\treq, err := http.NewRequest(\(quoteStringLiteral(request.method, flavor: .go)), url, \(bodyArg))",
            "\tif err != nil {",
            "\t\tpanic(err)",
            "\t}",
        ])

        for header in request.headers {
            let keyLiteral = quoteStringLiteral(header.key, flavor: .go)
            let valueLiteral = quoteStringLiteral(header.value, flavor: .go)
            lines.append("\treq.Header.Set(\(keyLiteral), \(valueLiteral))")
        }

        lines.append(contentsOf: [
            "",
            "\tres, err := http.DefaultClient.Do(req)",
            "\tif err != nil {",
            "\t\tpanic(err)",
            "\t}",
            "\tdefer res.Body.Close()",
            "",
            "\tbody, err := io.ReadAll(res.Body)",
            "\tif err != nil {",
            "\t\tpanic(err)",
            "\t}",
            "\tfmt.Println(string(body))",
            "}",
        ])

        return lines.joined(separator: "\n")
    }

    // MARK: - String Literal Escaping

    private static func quoteStringLiteral(_ value: String, flavor: StringLiteralFlavor) -> String {
        var out = "\""
        out.reserveCapacity(value.count + 8)

        for scalar in value.unicodeScalars {
            switch scalar.value {
            case 0x5C: // backslash
                out.append("\\\\")
            case 0x22: // double quote
                out.append("\\\"")
            case 0x0A: // LF
                out.append("\\n")
            case 0x0D: // CR
                out.append("\\r")
            case 0x09: // TAB
                out.append("\\t")
            case 0x00: // NUL
                switch flavor {
                case .swift:
                    out.append("\\0")
                case .javascript:
                    out.append("\\u0000")
                case .python, .go:
                    out.append("\\x00")
                }
            case 0x01..<0x20, 0x7F:
                let hex = String(scalar.value, radix: 16, uppercase: false)
                let padded = hex.count == 1 ? "0\(hex)" : hex
                switch flavor {
                case .swift:
                    out.append("\\u{\(padded)}")
                case .javascript:
                    out.append("\\u00\(padded)")
                case .python, .go:
                    out.append("\\x\(padded)")
                }
            case 0x2028...0x2029 where flavor == .javascript:
                let hex = String(scalar.value, radix: 16, uppercase: false)
                out.append("\\u\(hex)")
            default:
                out.unicodeScalars.append(scalar)
            }
        }

        out.append("\"")
        return out
    }
}
