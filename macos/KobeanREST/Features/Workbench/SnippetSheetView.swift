import AppKit
import Foundation
import SwiftUI

struct SnippetSheetView: View {
    let request: SavedRequest
    let customMethod: String?

    @Environment(\.dismiss) private var dismiss
    @State private var selectedLanguage: SnippetLanguage = .curl
    @State private var redactSensitiveHeaders: Bool = true
    @State private var copied: Bool = false

    init(request: SavedRequest, customMethod: String?) {
        self.request = request
        self.customMethod = customMethod
    }

    private var generatedSnippet: String {
        let input = Self.makeSnippetInput(request: request, customMethod: customMethod)
        return SnippetGenerator.generate(
            input,
            language: selectedLanguage,
            redactSensitiveHeaders: redactSensitiveHeaders
        )
    }

    var body: some View {
        VStack(spacing: 0) {
            headerBar
            Divider()
            controlsBar
            Divider()
            codeViewer
            Divider()
            footerBar
        }
        .frame(width: 680, height: 480)
    }

    private var headerBar: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Code Snippet")
                    .font(.system(size: 15, weight: .semibold))
                Text(request.name.isEmpty ? request.url : request.name)
                    .font(.system(size: 11.5, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            Button("Done") {
                dismiss()
            }
            .keyboardShortcut(.cancelAction)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color(nsColor: .controlBackgroundColor))
    }

    private var controlsBar: some View {
        HStack(spacing: 12) {
            Picker("Language", selection: $selectedLanguage) {
                ForEach(SnippetLanguage.allCases) { language in
                    Text(language.displayName).tag(language)
                }
            }
            .frame(width: 230)

            Spacer()

            Toggle("Redact sensitive headers", isOn: $redactSensitiveHeaders)
                .toggleStyle(.checkbox)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color(nsColor: .underPageBackgroundColor))
    }

    private var codeViewer: some View {
        ScrollView([.vertical, .horizontal]) {
            Text(generatedSnippet)
                .font(.system(size: 12, design: .monospaced))
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(nsColor: .textBackgroundColor))
    }

    private var footerBar: some View {
        HStack {
            Text("\(generatedSnippet.components(separatedBy: "\n").count) lines · \(generatedSnippet.utf8.count) B")
                .font(.system(size: 11, design: .monospaced))
                .monospacedDigit()
                .foregroundStyle(.secondary)

            Spacer()

            Button {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(generatedSnippet, forType: .string)
                copied = true
                Task {
                    try? await Task.sleep(for: .seconds(1.5))
                    copied = false
                }
            } label: {
                Label(copied ? "Copied to Clipboard" : "Copy Snippet", systemImage: copied ? "checkmark" : "doc.on.doc")
                    .font(.system(size: 12, weight: .medium))
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.small)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color(nsColor: .controlBackgroundColor))
    }

    // MARK: - Mapping Helper

    nonisolated static func makeSnippetInput(request: SavedRequest, customMethod: String?) -> SnippetRequestInput {
        let resolvedMethod: String = {
            if request.method.uppercased() == HTTPMethod.custom.rawValue {
                let custom = customMethod?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                return custom.isEmpty ? "GET" : custom.uppercased()
            }
            return request.method.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "GET" : request.method
        }()

        let resolvedURL = appendQueryParams(request.decodedQueryParams, to: request.url)
        let mappedHeaders = request.headers.map { (key: $0.key, value: $0.value, enabled: $0.enabled) }

        let mime = request.bodyMimeType.trimmingCharacters(in: .whitespacesAndNewlines)
        let resolvedBody: String?
        let resolvedMime: String?

        if mime.isEmpty {
            resolvedBody = nil
            resolvedMime = nil
        } else if mime == BodyMimeType.formUrlEncoded.rawValue,
                  request.body.isEmpty,
                  !request.decodedBodyForm.isEmpty {
            let pairs = request.decodedBodyForm
                .filter { $0.enabled && !$0.key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
                .map { entry -> String in
                    let k = encodeQueryComponent(entry.key)
                    let v = encodeQueryComponent(entry.value)
                    return "\(k)=\(v)"
                }
            resolvedBody = pairs.isEmpty ? nil : pairs.joined(separator: "&")
            resolvedMime = mime
        } else {
            resolvedBody = request.body.isEmpty ? nil : request.body
            resolvedMime = mime
        }

        return SnippetRequestInput(
            method: resolvedMethod,
            url: resolvedURL,
            headers: mappedHeaders,
            body: resolvedBody,
            bodyMimeType: resolvedMime
        )
    }

    nonisolated private static let safeQueryAllowedCharacters: CharacterSet = {
        var allowed = CharacterSet.urlQueryAllowed
        allowed.remove(charactersIn: "&=+#")
        return allowed
    }()

    nonisolated private static func encodeQueryComponent(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: safeQueryAllowedCharacters) ?? value
    }

    nonisolated private static func appendQueryParams(_ params: [HeaderEntry], to baseURL: String) -> String {
        let active = params.filter { $0.enabled && !$0.key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        guard !active.isEmpty else { return baseURL }

        let encodedPairs = active.map { entry -> String in
            let key = encodeQueryComponent(entry.key.trimmingCharacters(in: .whitespacesAndNewlines))
            let val = encodeQueryComponent(entry.value)
            return "\(key)=\(val)"
        }
        let separator = baseURL.contains("?") ? "&" : "?"
        return baseURL + separator + encodedPairs.joined(separator: "&")
    }
}
