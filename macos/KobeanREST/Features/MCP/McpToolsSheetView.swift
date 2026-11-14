import AppKit
import Foundation
import Observation
import SwiftUI

struct McpManifestEnvelope: Codable, Sendable {
    let manifestJson: String
    let serverName: String
    let version: String

    enum CodingKeys: String, CodingKey {
        case version
        case manifestJson = "manifest_json"
        case serverName = "server_name"
    }
}

struct McpInputSchema: Codable, Sendable, Hashable {
    let type: String?
    let required: [String]?
}

struct McpToolDefinition: Codable, Sendable, Identifiable, Hashable {
    var id: String { name }
    let name: String
    let description: String
    let inputSchema: McpInputSchema?
}

struct McpManifestPayload: Codable, Sendable {
    let name: String
    let version: String
    let description: String?
    let tools: [McpToolDefinition]
}

@Observable
@MainActor
final class McpToolsViewModel {
    let dataDirectoryURL: URL

    var serverName: String = "KobeanREST MCP Server"
    var serverVersion: String = ""
    var tools: [McpToolDefinition] = []
    var selectedToolName: String?
    var argumentsText: String = "{}"
    var outputJSON: String = ""
    var errorMessage: String?
    var isLoadingManifest: Bool = false
    var isExecuting: Bool = false

    init(dataDirectoryURL: URL) {
        self.dataDirectoryURL = dataDirectoryURL
    }

    var selectedTool: McpToolDefinition? {
        guard let selectedToolName else { return nil }
        return tools.first(where: { $0.name == selectedToolName })
    }

    func loadManifest() async {
        isLoadingManifest = true
        errorMessage = nil
        defer { isLoadingManifest = false }

        do {
            let envelopeJson = try await Task.detached(priority: .userInitiated) {
                try exportMcpManifestJson()
            }.value
            let envelope = try JSONDecoder().decode(McpManifestEnvelope.self, from: Data(envelopeJson.utf8))
            serverName = envelope.serverName
            serverVersion = envelope.version

            let payload = try JSONDecoder().decode(McpManifestPayload.self, from: Data(envelope.manifestJson.utf8))
            tools = payload.tools
            if selectedToolName == nil, let first = payload.tools.first {
                selectTool(first)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func selectTool(_ tool: McpToolDefinition) {
        selectedToolName = tool.name
        argumentsText = Self.defaultArgumentsTemplate(for: tool)
        outputJSON = ""
        errorMessage = nil
    }

    func runSelectedTool() async {
        guard let tool = selectedTool else { return }
        isExecuting = true
        errorMessage = nil
        defer { isExecuting = false }

        let trimmedArgs = argumentsText.trimmingCharacters(in: .whitespacesAndNewlines)
        let argsPayload = trimmedArgs.isEmpty ? "{}" : trimmedArgs

        if let data = argsPayload.data(using: .utf8),
           (try? JSONSerialization.jsonObject(with: data)) == nil {
            errorMessage = "Arguments must be valid JSON."
            return
        }

        let dirPath = dataDirectoryURL.path
        let toolName = tool.name
        do {
            let rawResult = try await Task.detached(priority: .userInitiated) {
                try executeMcpToolCallJson(dataDir: dirPath, toolName: toolName, arguments: argsPayload)
            }.value
            outputJSON = Self.prettyPrintJSON(rawResult)
        } catch {
            outputJSON = ""
            errorMessage = error.localizedDescription
        }
    }

    static func defaultArgumentsTemplate(for tool: McpToolDefinition) -> String {
        let required = tool.inputSchema?.required ?? []
        guard !required.isEmpty else { return "{}" }
        var dict: [String: String] = [:]
        for key in required {
            dict[key] = ""
        }
        guard let data = try? JSONSerialization.data(withJSONObject: dict, options: [.prettyPrinted, .sortedKeys]),
              let json = String(data: data, encoding: .utf8) else {
            return "{}"
        }
        return json
    }

    static func prettyPrintJSON(_ raw: String) -> String {
        guard let data = raw.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data),
              JSONSerialization.isValidJSONObject(object),
              let prettyData = try? JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted, .sortedKeys]),
              let pretty = String(data: prettyData, encoding: .utf8) else {
            return raw
        }
        return pretty
    }
}

struct McpToolsSheetView: View {
    let dataDirectoryURL: URL

    @Environment(\.dismiss) private var dismiss
    @State private var viewModel: McpToolsViewModel
    @State private var copiedOutput: Bool = false

    init(dataDirectoryURL: URL) {
        self.dataDirectoryURL = dataDirectoryURL
        self._viewModel = State(initialValue: McpToolsViewModel(dataDirectoryURL: dataDirectoryURL))
    }

    var body: some View {
        VStack(spacing: 0) {
            headerBar
            Divider()

            if viewModel.isLoadingManifest && viewModel.tools.isEmpty {
                VStack(spacing: 10) {
                    ProgressView()
                    Text("Loading MCP manifest…")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                HSplitView {
                    toolsListPane
                        .frame(minWidth: 210, idealWidth: 240, maxWidth: 290)
                    toolDetailPane
                        .frame(minWidth: 460)
                }
            }
        }
        .frame(width: 820, height: 560)
        .task {
            await viewModel.loadManifest()
        }
    }

    private var headerBar: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 8) {
                    Text("MCP Tools Inspector")
                        .font(.system(size: 15, weight: .semibold))
                    if !viewModel.serverVersion.isEmpty {
                        Text("v\(viewModel.serverVersion)")
                            .font(.system(size: 11, design: .monospaced))
                            .monospacedDigit()
                            .foregroundStyle(.secondary)
                    }
                }
                Text("Inspect and invoke \(viewModel.serverName) tools against local workspace storage.")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
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

    private var toolsListPane: some View {
        List(viewModel.tools, selection: Binding(
            get: { viewModel.selectedToolName },
            set: { name in
                if let name, let tool = viewModel.tools.first(where: { $0.name == name }) {
                    viewModel.selectTool(tool)
                }
            }
        )) { tool in
            VStack(alignment: .leading, spacing: 2) {
                Text(tool.name)
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                Text(tool.description)
                    .font(.system(size: 10.5))
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            .padding(.vertical, 2)
            .tag(tool.name)
        }
        .listStyle(.sidebar)
    }

    @ViewBuilder
    private var toolDetailPane: some View {
        if let tool = viewModel.selectedTool {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(tool.name)
                            .font(.system(size: 14, weight: .semibold, design: .monospaced))
                        Text(tool.description)
                            .font(.system(size: 12))
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button {
                        Task { await viewModel.runSelectedTool() }
                    } label: {
                        Label(viewModel.isExecuting ? "Running…" : "Run Tool", systemImage: "play.fill")
                            .font(.system(size: 12, weight: .medium))
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                    .disabled(viewModel.isExecuting)
                }

                if let required = tool.inputSchema?.required, !required.isEmpty {
                    Text("Required: \(required.joined(separator: ", "))")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(.secondary)
                }

                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("Arguments (JSON)")
                            .font(.system(size: 11.5, weight: .semibold))
                            .foregroundStyle(.secondary)
                        Spacer()
                        Button("Reset") {
                            viewModel.argumentsText = McpToolsViewModel.defaultArgumentsTemplate(for: tool)
                        }
                        .buttonStyle(.borderless)
                        .font(.system(size: 11))
                    }

                    TextEditor(text: $viewModel.argumentsText)
                        .font(.system(size: 12, design: .monospaced))
                        .scrollContentBackground(.hidden)
                        .frame(height: 110)
                        .padding(6)
                        .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 6))
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(Color.primary.opacity(0.10), lineWidth: 1)
                        )
                }

                if let error = viewModel.errorMessage {
                    HStack(spacing: 8) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(.red)
                        Text(error)
                            .font(.system(size: 11.5, design: .monospaced))
                            .foregroundStyle(.red)
                            .textSelection(.enabled)
                    }
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 6))
                }

                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("Output")
                            .font(.system(size: 11.5, weight: .semibold))
                            .foregroundStyle(.secondary)
                        Spacer()
                        Button {
                            NSPasteboard.general.clearContents()
                            NSPasteboard.general.setString(viewModel.outputJSON, forType: .string)
                            copiedOutput = true
                            Task {
                                try? await Task.sleep(for: .seconds(1.2))
                                copiedOutput = false
                            }
                        } label: {
                            Label(copiedOutput ? "Copied" : "Copy Output", systemImage: copiedOutput ? "checkmark" : "doc.on.doc")
                                .font(.system(size: 11))
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                        .disabled(viewModel.outputJSON.isEmpty)
                    }

                    ScrollView([.vertical, .horizontal]) {
                        Text(viewModel.outputJSON.isEmpty ? "Click Run Tool to execute and inspect output." : viewModel.outputJSON)
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundStyle(viewModel.outputJSON.isEmpty ? .secondary : .primary)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(8)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 6))
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(Color.primary.opacity(0.10), lineWidth: 1)
                    )
                }
            }
            .padding(14)
        } else {
            VStack(spacing: 8) {
                Text("Select an MCP tool from the list")
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}
