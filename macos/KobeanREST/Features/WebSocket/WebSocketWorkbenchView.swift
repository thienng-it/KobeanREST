import AppKit
import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class WebSocketViewModel {
    var url: String
    var headers: [HeaderEntry]
    var connectionState: WebSocketConnectionState = .disconnected
    var messages: [WebSocketMessage] = []
    var draftMessage: String = ""
    var isBinaryMode: Bool = false
    var lastError: String?
    var isPinging: Bool = false

    private let service: WebSocketService
    private var isObservingEvents: Bool = false

    init(
        url: String = "",
        headers: [HeaderEntry] = [],
        service: WebSocketService = WebSocketService()
    ) {
        self.url = url
        self.headers = headers
        self.service = service
    }

    var isConnected: Bool {
        if case .connected = connectionState { return true }
        return false
    }

    var isConnecting: Bool {
        if case .connecting = connectionState { return true }
        return false
    }

    var enabledHeaders: [HeaderEntry] {
        headers.filter { $0.enabled && !$0.key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }

    func observeEvents() async {
        guard !isObservingEvents else { return }
        isObservingEvents = true
        defer { isObservingEvents = false }

        for await event in service.events {
            if Task.isCancelled { break }
            handle(event)
        }
    }

    func connect() async {
        lastError = nil
        let targetURL = url.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !targetURL.isEmpty else {
            lastError = "Enter a ws:// or wss:// WebSocket URL."
            return
        }

        connectionState = .connecting(url: targetURL)
        var headerMap: [String: String] = [:]
        for entry in enabledHeaders {
            let key = entry.key.trimmingCharacters(in: .whitespacesAndNewlines)
            headerMap[key] = entry.value
        }

        do {
            try await service.connect(url: targetURL, headers: headerMap)
        } catch {
            if case .connecting = connectionState {
                connectionState = .disconnected
            }
            let message = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            lastError = message
        }
    }

    func disconnect() async {
        await service.disconnect()
    }

    func send() async {
        let payloadText = draftMessage
        guard !payloadText.isEmpty, isConnected else { return }
        lastError = nil

        do {
            if isBinaryMode {
                let data = Self.parseBinaryPayload(payloadText)
                try await service.sendData(data)
            } else {
                try await service.sendText(payloadText)
            }
            draftMessage = ""
        } catch {
            lastError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    func ping() async {
        guard isConnected, !isPinging else { return }
        isPinging = true
        lastError = nil
        defer { isPinging = false }

        do {
            try await service.ping()
            messages.append(
                WebSocketMessage(
                    direction: .system,
                    payload: .text("Ping acknowledged (pong received)")
                )
            )
        } catch {
            lastError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    func clearLog() {
        messages.removeAll()
    }

    private func handle(_ event: WebSocketEvent) {
        switch event {
        case .connected(let connectedURL):
            connectionState = .connected(url: connectedURL)
            lastError = nil
            messages.append(
                WebSocketMessage(
                    direction: .system,
                    payload: .text("Connected to \(connectedURL)")
                )
            )
        case .messageReceived(let message), .messageSent(let message):
            messages.append(message)
        case .disconnected(let code, let reason):
            connectionState = .disconnected
            let suffix = reason.map { $0.isEmpty ? "" : " (\($0))" } ?? ""
            messages.append(
                WebSocketMessage(
                    direction: .system,
                    payload: .text("Disconnected [code \(code)]\(suffix)")
                )
            )
        case .error(let message):
            lastError = message
            messages.append(
                WebSocketMessage(
                    direction: .system,
                    payload: .text("Error: \(message)")
                )
            )
        }
    }

    private static func parseBinaryPayload(_ text: String) -> Data {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("0x") || trimmed.hasPrefix("0X") {
            let hex = String(trimmed.dropFirst(2)).replacingOccurrences(of: " ", with: "")
            if hex.count.isMultiple(of: 2), !hex.isEmpty {
                var bytes = Data(capacity: hex.count / 2)
                var index = hex.startIndex
                var valid = true
                while index < hex.endIndex {
                    let next = hex.index(index, offsetBy: 2)
                    if let byte = UInt8(hex[index..<next], radix: 16) {
                        bytes.append(byte)
                    } else {
                        valid = false
                        break
                    }
                    index = next
                }
                if valid { return bytes }
            }
        }
        return Data(text.utf8)
    }
}

struct WebSocketWorkbenchView: View {
    let url: String
    let headers: [HeaderEntry]

    @State private var viewModel: WebSocketViewModel
    @State private var showHeadersPopover: Bool = false

    private static let timestampFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss.SSS"
        return formatter
    }()

    init(
        url: String,
        headers: [HeaderEntry],
        initialViewModel: WebSocketViewModel? = nil
    ) {
        self.url = url
        self.headers = headers
        self._viewModel = State(initialValue: initialViewModel ?? WebSocketViewModel(url: url, headers: headers))
    }

    var body: some View {
        VStack(spacing: 0) {
            connectionToolbar
            Divider()

            if let error = viewModel.lastError {
                errorBanner(error)
                Divider()
            }

            messageLogSection
            Divider()
            composerSection
        }
        .background(Color(nsColor: .textBackgroundColor))
        .task {
            await viewModel.observeEvents()
        }
        .onChange(of: url) { _, newValue in
            if !viewModel.isConnected && !viewModel.isConnecting {
                viewModel.url = newValue
            }
        }
        .onChange(of: headers) { _, newValue in
            if !viewModel.isConnected && !viewModel.isConnecting {
                viewModel.headers = newValue
            }
        }
        .onDisappear {
            Task {
                await viewModel.disconnect()
            }
        }
    }

    // MARK: - Top Toolbar

    private var connectionToolbar: some View {
        HStack(spacing: 8) {
            statusBadge

            TextField("wss://echo.websocket.events", text: $viewModel.url)
                .textFieldStyle(.roundedBorder)
                .font(.system(size: 12.5, design: .monospaced))
                .disabled(viewModel.isConnected || viewModel.isConnecting)
                .onSubmit {
                    if !viewModel.isConnected && !viewModel.isConnecting {
                        Task { await viewModel.connect() }
                    }
                }

            Button {
                showHeadersPopover.toggle()
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "list.bullet.rectangle")
                        .font(.system(size: 11))
                    Text("Headers (\(viewModel.enabledHeaders.count))")
                        .font(.system(size: 11.5, weight: .medium))
                        .monospacedDigit()
                }
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            .popover(isPresented: $showHeadersPopover, arrowEdge: .bottom) {
                headersPopover
            }

            if viewModel.isConnected || viewModel.isConnecting {
                Button("Disconnect") {
                    Task { await viewModel.disconnect() }
                }
                .buttonStyle(.borderedProminent)
                .tint(.red)
                .controlSize(.small)
            } else {
                Button("Connect") {
                    Task { await viewModel.connect() }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
                .disabled(viewModel.url.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }

            Button {
                Task { await viewModel.ping() }
            } label: {
                Label(viewModel.isPinging ? "Pinging…" : "Ping", systemImage: "waveform.path")
                    .font(.system(size: 11.5))
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            .disabled(!viewModel.isConnected || viewModel.isPinging)

            Button {
                viewModel.clearLog()
            } label: {
                Label("Clear", systemImage: "trash")
                    .font(.system(size: 11.5))
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            .disabled(viewModel.messages.isEmpty)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color(nsColor: .controlBackgroundColor))
    }

    private var statusBadge: some View {
        let (label, color): (String, Color) = {
            switch viewModel.connectionState {
            case .disconnected:
                return ("Disconnected", .secondary)
            case .connecting:
                return ("Connecting", .orange)
            case .connected:
                return ("Connected", .green)
            }
        }()

        return HStack(spacing: 6) {
            Circle()
                .fill(color)
                .frame(width: 7, height: 7)
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(color)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 5))
    }

    private var headersPopover: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Handshake Headers")
                .font(.system(size: 12.5, weight: .semibold))
            if viewModel.enabledHeaders.isEmpty {
                Text("No enabled request headers.")
                    .font(.system(size: 11.5))
                    .foregroundStyle(.secondary)
            } else {
                ForEach(viewModel.enabledHeaders) { entry in
                    HStack(spacing: 8) {
                        Text(entry.key)
                            .font(.system(size: 11.5, weight: .medium, design: .monospaced))
                        Spacer()
                        Text(entry.value)
                            .font(.system(size: 11.5, design: .monospaced))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
            }
        }
        .padding(12)
        .frame(width: 320)
    }

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 12))
                .foregroundStyle(.red)
            Text(message)
                .font(.system(size: 11.5, design: .monospaced))
                .foregroundStyle(.red)
                .textSelection(.enabled)
            Spacer()
            Button {
                viewModel.lastError = nil
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 10, weight: .semibold))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color.red.opacity(0.08))
    }

    // MARK: - Message Stream

    @ViewBuilder
    private var messageLogSection: some View {
        if viewModel.messages.isEmpty {
            VStack(spacing: 10) {
                Image(systemName: "bolt.horizontal")
                    .font(.system(size: 26, weight: .light))
                    .foregroundStyle(.secondary)
                Text("No WebSocket Frames Yet")
                    .font(.system(size: 13.5, weight: .semibold))
                Text("Connect to a ws:// or wss:// endpoint to stream incoming and outgoing frames.")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                if !viewModel.isConnected && !viewModel.isConnecting {
                    Button("Connect") {
                        Task { await viewModel.connect() }
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                    .disabled(viewModel.url.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(viewModel.messages) { msg in
                            messageRow(msg)
                            Divider()
                        }
                    }
                }
                .onChange(of: viewModel.messages.count) { _, _ in
                    if let lastID = viewModel.messages.last?.id {
                        proxy.scrollTo(lastID, anchor: .bottom)
                    }
                }
            }
        }
    }

    private func messageRow(_ msg: WebSocketMessage) -> some View {
        let (tag, color): (String, Color) = {
            switch msg.direction {
            case .incoming: return ("IN", .green)
            case .outgoing: return ("OUT", .blue)
            case .system: return ("SYS", .secondary)
            }
        }()

        let (payloadText, formatLabel, byteCount): (String, String, Int) = {
            switch msg.payload {
            case .text(let str):
                return (str, "TEXT", str.utf8.count)
            case .binary(let data):
                let preview: String
                if let utf8 = String(data: data, encoding: .utf8), !utf8.isEmpty {
                    preview = utf8
                } else {
                    preview = data.map { String(format: "%02x", $0) }.joined(separator: " ")
                }
                return (preview, "BIN", data.count)
            }
        }()

        return HStack(alignment: .top, spacing: 10) {
            Text(Self.timestampFormatter.string(from: msg.timestamp))
                .font(.system(size: 11, design: .monospaced))
                .monospacedDigit()
                .foregroundStyle(.secondary)
                .frame(width: 82, alignment: .leading)

            Text(tag)
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .foregroundStyle(color)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 4))
                .frame(width: 38)

            Text(payloadText)
                .font(.system(size: 12, design: .monospaced))
                .foregroundStyle(msg.direction == .system ? .secondary : .primary)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)

            if msg.direction != .system {
                Text("\(formatLabel) · \(byteCount) B")
                    .font(.system(size: 10.5, design: .monospaced))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .id(msg.id)
    }

    // MARK: - Composer

    private var composerSection: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                Picker("Payload Mode", selection: $viewModel.isBinaryMode) {
                    Text("Text").tag(false)
                    Text("Binary (UTF-8 / 0xHex)").tag(true)
                }
                .pickerStyle(.segmented)
                .labelsHidden()
                .frame(width: 220)

                Spacer()

                Text("\(viewModel.draftMessage.utf8.count) B")
                    .font(.system(size: 11, design: .monospaced))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)

                Button {
                    Task { await viewModel.send() }
                } label: {
                    Label("Send", systemImage: "paperplane.fill")
                        .font(.system(size: 11.5, weight: .medium))
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
                .keyboardShortcut(.return, modifiers: [.command])
                .disabled(!viewModel.isConnected || viewModel.draftMessage.isEmpty)
            }

            TextEditor(text: $viewModel.draftMessage)
                .font(.system(size: 12, design: .monospaced))
                .scrollContentBackground(.hidden)
                .frame(height: 84)
                .padding(4)
                .background(Color(nsColor: .underPageBackgroundColor), in: RoundedRectangle(cornerRadius: 6))
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Color.primary.opacity(0.10), lineWidth: 1)
                )
        }
        .padding(12)
        .background(Color(nsColor: .controlBackgroundColor))
    }
}
