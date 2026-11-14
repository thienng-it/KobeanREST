import AppKit
import SwiftUI
import UniformTypeIdentifiers

struct ImportSheetView: View {
    @Bindable var appState: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var rawContent: String = ""
    @State private var detectedFormat: String = "unknown"
    @State private var errorMessage: String?
    @State private var isImporting: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Import Collection, Spec, or cURL")
                        .font(.system(size: 15, weight: .semibold))
                    Text("Supports cURL, Postman v2.1, OpenAPI 3.0, Insomnia, HAR, Hoppscotch, and KobeanREST JSON.")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button("Choose File…") {
                    chooseFile()
                }
                .controlSize(.small)
            }

            TextEditor(text: $rawContent)
                .font(.system(size: 12, design: .monospaced))
                .frame(minHeight: 240)
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Color.primary.opacity(0.12), lineWidth: 1)
                )
                .onChange(of: rawContent) { _, newValue in
                    Task {
                        detectedFormat = await appState.bridge.detectImportFormat(content: newValue)
                    }
                }

            if let errorMessage {
                Text(errorMessage)
                    .font(.system(size: 11.5))
                    .foregroundStyle(.red)
            }

            HStack {
                Text("Detected format: \(detectedFormat)")
                    .font(.system(size: 11.5, design: .monospaced))
                    .foregroundStyle(.secondary)

                Spacer()

                Button("Cancel") { dismiss() }
                    .keyboardShortcut(.cancelAction)

                Button(isImporting ? "Importing…" : "Import") {
                    runImport()
                }
                .buttonStyle(.borderedProminent)
                .disabled(isImporting || rawContent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(18)
        .frame(width: 620, height: 420)
    }

    private func chooseFile() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.json, .yaml, .plainText]
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        if panel.runModal() == .OK, let url = panel.url, let text = try? String(contentsOf: url, encoding: .utf8) {
            rawContent = text
        }
    }

    private func runImport() {
        isImporting = true
        errorMessage = nil
        Task {
            defer { isImporting = false }
            do {
                _ = try await appState.importUniversal(content: rawContent)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
