import Foundation
import XCTest
#if canImport(KobeanREST)
@testable import KobeanREST
#endif

final class SnippetGeneratorTests: XCTestCase {
    // MARK: - Language Metadata

    func testSnippetLanguagesCoverAllSixTargetsWithDisplayNames() {
        let languages = SnippetLanguage.allCases
        XCTAssertEqual(languages.count, 6)
        XCTAssertEqual(
            Set(languages),
            [.curl, .swiftURLSession, .javascriptFetch, .pythonRequests, .httpie, .goNetHttp]
        )

        let ids = languages.map(\.id)
        XCTAssertEqual(Set(ids).count, 6)

        for language in languages {
            XCTAssertFalse(language.displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
    }

    // MARK: - All 6 Languages (POST with Body & Headers)

    func testGeneratesValidSnippetsForAllSixLanguages() {
        let input = SnippetRequestInput(
            method: "post",
            url: "https://api.example.com/v1/users",
            headers: [
                (key: "Accept", value: "application/json", enabled: true),
                (key: "X-Trace-Id", value: "trace-42", enabled: true),
            ],
            body: #"{"name":"Ada"}"#,
            bodyMimeType: "application/json"
        )

        let curl = SnippetGenerator.generate(input, language: .curl)
        XCTAssertTrue(curl.contains("curl -X POST -- 'https://api.example.com/v1/users'"))
        XCTAssertTrue(curl.contains("-H 'Accept: application/json'"))
        XCTAssertTrue(curl.contains("-H 'X-Trace-Id: trace-42'"))
        XCTAssertTrue(curl.contains("-H 'Content-Type: application/json'"))
        XCTAssertTrue(curl.contains(#"--data-raw '{"name":"Ada"}'"#))

        let swift = SnippetGenerator.generate(input, language: .swiftURLSession)
        XCTAssertTrue(swift.contains("import Foundation"))
        XCTAssertTrue(swift.contains(#"URL(string: "https://api.example.com/v1/users")"#))
        XCTAssertTrue(swift.contains(#"request.httpMethod = "POST""#))
        XCTAssertTrue(swift.contains(#"request.setValue("application/json", forHTTPHeaderField: "Accept")"#))
        XCTAssertTrue(swift.contains(#"request.setValue("application/json", forHTTPHeaderField: "Content-Type")"#))
        XCTAssertTrue(swift.contains(#"request.httpBody = Data("{\"name\":\"Ada\"}".utf8)"#))
        XCTAssertTrue(swift.contains("URLSession.shared.data(for: request)"))

        let js = SnippetGenerator.generate(input, language: .javascriptFetch)
        XCTAssertTrue(js.contains(#"await fetch("https://api.example.com/v1/users""#))
        XCTAssertTrue(js.contains(#"method: "POST""#))
        XCTAssertTrue(js.contains(#""Accept": "application/json""#))
        XCTAssertTrue(js.contains(#""Content-Type": "application/json""#))
        XCTAssertTrue(js.contains(#"body: "{\"name\":\"Ada\"}""#))

        let python = SnippetGenerator.generate(input, language: .pythonRequests)
        XCTAssertTrue(python.contains("import requests"))
        XCTAssertTrue(python.contains(#"url = "https://api.example.com/v1/users""#))
        XCTAssertTrue(python.contains(#""Accept": "application/json""#))
        XCTAssertTrue(python.contains(#""Content-Type": "application/json""#))
        XCTAssertTrue(python.contains(#"payload = "{\"name\":\"Ada\"}""#))
        XCTAssertTrue(python.contains(#"requests.request("POST", url, headers=headers, data=payload.encode("utf-8"))"#))

        let httpie = SnippetGenerator.generate(input, language: .httpie)
        XCTAssertTrue(httpie.contains("http POST -- 'https://api.example.com/v1/users'"))
        XCTAssertTrue(httpie.contains("'Accept:application/json'"))
        XCTAssertTrue(httpie.contains("'X-Trace-Id:trace-42'"))
        XCTAssertTrue(httpie.contains("'Content-Type:application/json'"))
        XCTAssertTrue(httpie.contains(#"--raw '{"name":"Ada"}'"#))

        let go = SnippetGenerator.generate(input, language: .goNetHttp)
        XCTAssertTrue(go.contains(#""net/http""#))
        XCTAssertTrue(go.contains(#""strings""#))
        XCTAssertTrue(go.contains(#"url := "https://api.example.com/v1/users""#))
        XCTAssertTrue(go.contains(#"payload := strings.NewReader("{\"name\":\"Ada\"}")"#))
        XCTAssertTrue(go.contains(#"http.NewRequest("POST", url, payload)"#))
        XCTAssertTrue(go.contains(#"req.Header.Set("Accept", "application/json")"#))
        XCTAssertTrue(go.contains(#"req.Header.Set("Content-Type", "application/json")"#))
    }

    // MARK: - Disabled Headers & Content-Type Deduplication

    func testDisabledHeadersAreOmitted() {
        let input = SnippetRequestInput(
            method: "GET",
            url: "https://api.example.com/items",
            headers: [
                (key: "Accept", value: "application/json", enabled: true),
                (key: "X-Disabled-Debug", value: "should-not-appear", enabled: false),
                (key: "X-Also-Disabled", value: "nope", enabled: false),
                (key: "   ", value: "blank-key", enabled: true),
            ]
        )

        for language in SnippetLanguage.allCases {
            let output = SnippetGenerator.generate(input, language: language)
            XCTAssertTrue(output.contains("Accept"), "Expected enabled header in \(language)")
            XCTAssertFalse(output.contains("X-Disabled-Debug"), "Disabled header leaked in \(language)")
            XCTAssertFalse(output.contains("should-not-appear"), "Disabled header value leaked in \(language)")
            XCTAssertFalse(output.contains("X-Also-Disabled"), "Disabled header leaked in \(language)")
            XCTAssertFalse(output.contains("blank-key"), "Whitespace-only key leaked in \(language)")
        }
    }

    func testExplicitContentTypeHeaderPreventsDuplicateFromBodyMimeType() {
        let input = SnippetRequestInput(
            method: "POST",
            url: "https://api.example.com/items",
            headers: [
                (key: "content-type", value: "application/merge-patch+json", enabled: true),
            ],
            body: #"{"a":1}"#,
            bodyMimeType: "application/json"
        )

        let curl = SnippetGenerator.generate(input, language: .curl)
        XCTAssertTrue(curl.contains("content-type: application/merge-patch+json"))
        XCTAssertFalse(curl.contains("Content-Type: application/json"))
    }

    // MARK: - Empty Body Handling

    func testEmptyAndNilBodyAreSkippedByDefaultAcrossAllLanguages() {
        let nilBodyInput = SnippetRequestInput(
            method: "GET",
            url: "https://api.example.com/health",
            headers: [],
            body: nil,
            bodyMimeType: "application/json"
        )
        let emptyBodyInput = SnippetRequestInput(
            method: "POST",
            url: "https://api.example.com/ping",
            headers: [],
            body: "",
            bodyMimeType: "application/json"
        )

        for input in [nilBodyInput, emptyBodyInput] {
            let curl = SnippetGenerator.generate(input, language: .curl)
            XCTAssertFalse(curl.contains("--data-raw"))
            XCTAssertFalse(curl.contains("Content-Type"))

            let swift = SnippetGenerator.generate(input, language: .swiftURLSession)
            XCTAssertFalse(swift.contains("httpBody"))
            XCTAssertFalse(swift.contains("Content-Type"))

            let js = SnippetGenerator.generate(input, language: .javascriptFetch)
            XCTAssertFalse(js.contains("body:"))
            XCTAssertFalse(js.contains("Content-Type"))

            let python = SnippetGenerator.generate(input, language: .pythonRequests)
            XCTAssertFalse(python.contains("payload"))
            XCTAssertFalse(python.contains("data="))

            let httpie = SnippetGenerator.generate(input, language: .httpie)
            XCTAssertFalse(httpie.contains("--raw"))

            let go = SnippetGenerator.generate(input, language: .goNetHttp)
            XCTAssertFalse(go.contains(#""strings""#))
            XCTAssertTrue(go.contains("nil)"))
        }
    }

    func testExplicitIncludeEmptyBodyEmitsEmptyBody() {
        let input = SnippetRequestInput(
            method: "POST",
            url: "https://api.example.com/ping",
            headers: [],
            body: "",
            bodyMimeType: "text/plain"
        )

        let curl = SnippetGenerator.generate(input, language: .curl, includeEmptyBody: true)
        XCTAssertTrue(curl.contains("--data-raw ''"))
        XCTAssertTrue(curl.contains("-H 'Content-Type: text/plain'"))

        let httpie = SnippetGenerator.generate(input, language: .httpie, includeEmptyBody: true)
        XCTAssertTrue(httpie.contains("--raw ''"))

        let swift = SnippetGenerator.generate(input, language: .swiftURLSession, includeEmptyBody: true)
        XCTAssertTrue(swift.contains(#"request.httpBody = Data("".utf8)"#))

        let go = SnippetGenerator.generate(input, language: .goNetHttp, includeEmptyBody: true)
        XCTAssertTrue(go.contains(#"strings.NewReader("")"#))
    }

    // MARK: - Shell Single-Quote Injection Escaping

    func testShellSingleQuoteEscapingPreventsCommandInjection() {
        let payload = #"'; rm -rf /; echo "$(whoami)" `id` #"#
        let input = SnippetRequestInput(
            method: "POST",
            url: "https://api.example.com/search?q=';touch /tmp/pwned #",
            headers: [
                (key: "X-Custom'Header", value: "val'$(id)`uname`", enabled: true),
            ],
            body: payload,
            bodyMimeType: "text/plain"
        )

        let curl = SnippetGenerator.generate(input, language: .curl)
        XCTAssertTrue(curl.contains("'https://api.example.com/search?q='\\'';touch /tmp/pwned #'"))
        XCTAssertTrue(curl.contains("-H 'X-Custom'\\''Header: val'\\''$(id)`uname`'"))
        XCTAssertTrue(curl.contains(#"--data-raw ''\''; rm -rf /; echo "$(whoami)" `id` #'"#))

        let httpie = SnippetGenerator.generate(input, language: .httpie)
        XCTAssertTrue(httpie.contains("'https://api.example.com/search?q='\\'';touch /tmp/pwned #'"))
        XCTAssertTrue(httpie.contains("'X-Custom'\\''Header:val'\\''$(id)`uname`'"))
        XCTAssertTrue(httpie.contains(#"--raw ''\''; rm -rf /; echo "$(whoami)" `id` #'"#))
    }

    func testCurlUsesDataRawForLeadingAtSignBody() {
        let input = SnippetRequestInput(
            method: "POST",
            url: "https://api.example.com/upload",
            body: "@/etc/passwd"
        )

        let curl = SnippetGenerator.generate(input, language: .curl)
        XCTAssertTrue(curl.contains("--data-raw '@/etc/passwd'"))
        XCTAssertFalse(curl.contains(" -d "))
    }

    // MARK: - Language String Literal Escaping

    func testStringLiteralEscapingAcrossSwiftJsPythonAndGo() {
        let trickyBody = "line1\nline2\r\n\tquote:\"\\slash\\(inject)${js}\0end"
        let input = SnippetRequestInput(
            method: "POST",
            url: "https://api.example.com/echo?x=\"a\\b\"",
            headers: [
                (key: "X-Note", value: "a\\b\"c\nd", enabled: true),
            ],
            body: trickyBody
        )

        let swift = SnippetGenerator.generate(input, language: .swiftURLSession)
        XCTAssertTrue(swift.contains(#"line1\nline2\r\n\tquote:\"\\slash\\(inject)${js}\0end"#))
        XCTAssertTrue(swift.contains(#"request.setValue("a\\b\"c\nd", forHTTPHeaderField: "X-Note")"#))

        let js = SnippetGenerator.generate(input, language: .javascriptFetch)
        XCTAssertTrue(js.contains(#"line1\nline2\r\n\tquote:\"\\slash\\(inject)${js}\u0000end"#))

        let python = SnippetGenerator.generate(input, language: .pythonRequests)
        XCTAssertTrue(python.contains(#"line1\nline2\r\n\tquote:\"\\slash\\(inject)${js}\x00end"#))

        let go = SnippetGenerator.generate(input, language: .goNetHttp)
        XCTAssertTrue(go.contains(#"line1\nline2\r\n\tquote:\"\\slash\\(inject)${js}\x00end"#))
        XCTAssertFalse(go.contains(#"\0end"#))
    }

    // MARK: - Sensitive Header Redaction

    func testSensitiveHeadersAreRedactedByDefault() {
        let input = SnippetRequestInput(
            method: "GET",
            url: "https://api.example.com/me",
            headers: [
                (key: "Authorization", value: "Bearer super-secret-jwt", enabled: true),
                (key: "x-api-key", value: "sk_live_987654321", enabled: true),
                (key: "Cookie", value: "session=secret-cookie-val", enabled: true),
                (key: "X-Custom-Secret", value: "top-secret-phrase", enabled: true),
                (key: "Accept", value: "application/json", enabled: true),
            ]
        )

        for language in SnippetLanguage.allCases {
            let snippet = SnippetGenerator.generate(input, language: language)
            XCTAssertFalse(snippet.contains("super-secret-jwt"), "Authorization leaked in \(language)")
            XCTAssertFalse(snippet.contains("sk_live_987654321"), "API key leaked in \(language)")
            XCTAssertFalse(snippet.contains("secret-cookie-val"), "Cookie leaked in \(language)")
            XCTAssertFalse(snippet.contains("top-secret-phrase"), "Custom secret leaked in \(language)")
            XCTAssertTrue(snippet.contains(SnippetGenerator.redactedPlaceholder), "Missing placeholder in \(language)")
            XCTAssertTrue(snippet.contains("application/json"), "Non-sensitive header was unexpectedly redacted in \(language)")
        }
    }

    func testSensitiveHeadersArePreservedWhenRedactionIsDisabled() {
        let input = SnippetRequestInput(
            method: "GET",
            url: "https://api.example.com/me",
            headers: [
                (key: "Authorization", value: "Bearer super-secret-jwt", enabled: true),
                (key: "X-API-Key", value: "sk_live_987654321", enabled: true),
            ]
        )

        for language in SnippetLanguage.allCases {
            let snippet = SnippetGenerator.generate(input, language: language, redactSensitiveHeaders: false)
            XCTAssertTrue(snippet.contains("Bearer super-secret-jwt"), "Expected raw Authorization in \(language)")
            XCTAssertTrue(snippet.contains("sk_live_987654321"), "Expected raw X-API-Key in \(language)")
        }
    }

    // MARK: - Method Sanitization & Concurrency

    func testMethodSanitizationAndSendableExecution() async {
        let input = SnippetRequestInput(
            method: "  post\n; rm -rf / ",
            url: "https://api.example.com/v1/items"
        )

        let generated = await Task.detached {
            SnippetGenerator.generate(input, language: .curl)
        }.value

        XCTAssertTrue(generated.hasPrefix("curl -X POST -- 'https://api.example.com/v1/items'"))
        XCTAssertFalse(generated.contains("rm -rf"))

        let emptyMethod = SnippetRequestInput(method: "   ", url: "https://api.example.com")
        XCTAssertTrue(SnippetGenerator.generate(emptyMethod, language: .curl).hasPrefix("curl -X GET -- "))
    }

    func testSensitiveQueryParametersAreRedactedInURLWhenRedactionIsEnabled() {
        let input = SnippetRequestInput(
            method: "GET",
            url: "https://api.example.com/export?token=tok_secret&api_key=ak_123&apikey=ak_456&access_token=at_789&secret=sec_000&client_secret=cs_111&page=2#frag"
        )

        for language in SnippetLanguage.allCases {
            let redacted = SnippetGenerator.generate(input, language: language, redactSensitiveHeaders: true)
            XCTAssertFalse(redacted.contains("tok_secret"), "token leaked in \(language)")
            XCTAssertFalse(redacted.contains("ak_123"), "api_key leaked in \(language)")
            XCTAssertFalse(redacted.contains("ak_456"), "apikey leaked in \(language)")
            XCTAssertFalse(redacted.contains("at_789"), "access_token leaked in \(language)")
            XCTAssertFalse(redacted.contains("sec_000"), "secret leaked in \(language)")
            XCTAssertFalse(redacted.contains("cs_111"), "client_secret leaked in \(language)")
            XCTAssertTrue(redacted.contains("page=2#frag"), "non-sensitive param/fragment altered in \(language)")
            XCTAssertTrue(redacted.contains("token=\(SnippetGenerator.redactedPlaceholder)"))

            let unredacted = SnippetGenerator.generate(input, language: language, redactSensitiveHeaders: false)
            XCTAssertTrue(unredacted.contains("tok_secret"))
            XCTAssertTrue(unredacted.contains("cs_111"))
        }
    }

    func testSnippetSheetViewPercentEncodesReservedQueryAndFormCharacters() {
        var req = SavedRequest(
            id: "req-encode",
            name: "Encode",
            method: "POST",
            url: "https://api.example.com/search",
            bodyMimeType: BodyMimeType.formUrlEncoded.rawValue
        )
        req.setQueryParams([
            HeaderEntry(key: "a&b=c", value: "1+2=3#frag&x", enabled: true)
        ])
        req.setBodyForm([
            HeaderEntry(key: "k=1", value: "v&2+3#4", enabled: true)
        ])

        let input = SnippetSheetView.makeSnippetInput(request: req, customMethod: nil)
        XCTAssertEqual(
            input.url,
            "https://api.example.com/search?a%26b%3Dc=1%2B2%3D3%23frag%26x"
        )
        XCTAssertEqual(input.body, "k%3D1=v%262%2B3%234")
    }
}
