import AppKit
import SwiftUI

struct ResponseInspectorView: View {
    let responseState: ResponseState
    @Binding var selectedTab: ResponseInspectorTab
    let autoWrap: Bool
    var testResults: [ScriptTestResult] = []
    var scriptLogs: [ScriptLogEntry] = []
    let onCancel: () -> Void
    let onRetry: () -> Void

    @State private var showRawBody: Bool = false
    @State private var copiedBody: Bool = false

    var body: some View {
        VStack(spacing: 0) {
            switch responseState {
            case .idle:
                idleView
            case .loading(let startedAt):
                loadingView(startedAt: startedAt)
            case .error(let message):
                errorView(message: message)
            case .success(let response):
                successView(response: response)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(nsColor: .textBackgroundColor))
    }

    private var idleView: some View {
        VStack(spacing: 10) {
            Image(systemName: "paperplane")
                .font(.system(size: 28, weight: .light))
                .foregroundStyle(.secondary)
            Text("Ready to Send")
                .font(.system(size: 14, weight: .semibold))
            Text("Press ⌘Return to execute the active request.")
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func loadingView(startedAt: Date) -> some View {
        VStack(spacing: 12) {
            ProgressView()
                .controlSize(.regular)
            TimelineView(.periodic(from: startedAt, by: 0.1)) { context in
                let elapsedMs = max(0, Int(context.date.timeIntervalSince(startedAt) * 1000))
                Text("Sending request… \(elapsedMs) ms")
                    .font(.system(size: 12, design: .monospaced))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }
            Button("Cancel") {
                onCancel()
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorView(message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 26, weight: .regular))
                .foregroundStyle(.red)
            Text("Request Failed")
                .font(.system(size: 14, weight: .semibold))
            Text(message)
                .font(.system(size: 12, design: .monospaced))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .textSelection(.enabled)
                .frame(maxWidth: 460)
            Button("Retry", action: onRetry)
                .buttonStyle(.borderedProminent)
                .controlSize(.small)

            if !scriptLogs.isEmpty {
                Divider()
                    .padding(.vertical, 4)
                scriptLogsList
                    .frame(maxWidth: 520, maxHeight: 180)
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func successView(response: ExecuteHttpResponse) -> some View {
        VStack(spacing: 0) {
            statusBar(for: response)
            Divider()

            switch selectedTab {
            case .body:
                bodyView(for: response)
            case .headers:
                headersView(for: response)
            case .timing:
                timingView(for: response)
            case .tests:
                testsAndLogsView
            }
        }
    }

    private func statusBar(for response: ExecuteHttpResponse) -> some View {
        HStack(spacing: 12) {
            Picker("Response Tab", selection: $selectedTab) {
                ForEach(ResponseInspectorTab.allCases) { tab in
                    Text(tabLabel(tab, response: response)).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .frame(maxWidth: 380)

            Spacer()

            HStack(spacing: 10) {
                Text("\(response.status) \(response.statusText)")
                    .font(.system(size: 11.5, weight: .semibold, design: .monospaced))
                    .monospacedDigit()
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
                    .foregroundStyle(response.statusColor)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(response.statusColor.opacity(0.12), in: RoundedRectangle(cornerRadius: 5))

                Text("\(response.durationMs) ms")
                    .font(.system(size: 11.5, weight: .medium, design: .monospaced))
                    .monospacedDigit()
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
                    .foregroundStyle(.secondary)

                Text(formattedBytes(response.sizeBytes))
                    .font(.system(size: 11.5, weight: .medium, design: .monospaced))
                    .monospacedDigit()
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
                    .foregroundStyle(.secondary)
            }
            .layoutPriority(1)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color(nsColor: .controlBackgroundColor))
    }

    private func tabLabel(_ tab: ResponseInspectorTab, response: ExecuteHttpResponse) -> String {
        switch tab {
        case .body: return "Body"
        case .headers: return "Headers (\(response.headers.count))"
        case .timing: return "Timing"
        case .tests:
            if !testResults.isEmpty {
                let passed = testResults.filter(\.passed).count
                return "Tests (\(passed)/\(testResults.count))"
            } else if !scriptLogs.isEmpty {
                return "Logs (\(scriptLogs.count))"
            }
            return "Tests & Logs"
        }
    }

    private func bodyView(for response: ExecuteHttpResponse) -> some View {
        let content = showRawBody ? (response.bodyText ?? "") : response.prettyPrintedBody
        return VStack(spacing: 0) {
            HStack(spacing: 8) {
                Toggle("Raw", isOn: $showRawBody)
                    .toggleStyle(.checkbox)
                    .font(.system(size: 11.5))

                if let contentType = response.contentType, !contentType.isEmpty {
                    Text(contentType)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Spacer()

                Button {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(content, forType: .string)
                    copiedBody = true
                    Task {
                        try? await Task.sleep(for: .seconds(1.5))
                        copiedBody = false
                    }
                } label: {
                    Label(copiedBody ? "Copied" : "Copy", systemImage: copiedBody ? "checkmark" : "doc.on.doc")
                        .font(.system(size: 11.5))
                }
                .buttonStyle(.borderless)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color(nsColor: .underPageBackgroundColor))

            Divider()

            ScrollView(autoWrap ? [.vertical] : [.vertical, .horizontal]) {
                Text(content.isEmpty ? "(Empty response body)" : content)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(content.isEmpty ? .secondary : .primary)
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                    .padding(12)
            }
        }
    }

    private func headersView(for response: ExecuteHttpResponse) -> some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(Array(response.headers.enumerated()), id: \.offset) { idx, header in
                    HStack(alignment: .top, spacing: 12) {
                        Text("\(idx + 1)")
                            .font(.system(size: 11, design: .monospaced))
                            .monospacedDigit()
                            .foregroundStyle(.tertiary)
                            .frame(width: 24, alignment: .trailing)
                        Text(header.key)
                            .font(.system(size: 12, weight: .semibold, design: .monospaced))
                            .frame(width: 200, alignment: .leading)
                            .textSelection(.enabled)
                        Text(header.value)
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .textSelection(.enabled)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    Divider()
                }
            }
        }
    }

    private func timingView(for response: ExecuteHttpResponse) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            timingRow("DNS Lookup", ms: response.dnsMs, total: response.durationMs)
            timingRow("TCP Connect", ms: response.connectMs, total: response.durationMs)
            timingRow("TLS Handshake", ms: response.tlsMs, total: response.durationMs)
            timingRow("Request & Wait", ms: response.requestMs, total: response.durationMs)
            Divider()
            HStack {
                Text("Total Duration")
                    .font(.system(size: 12.5, weight: .semibold))
                Spacer()
                Text("\(response.durationMs) ms")
                    .font(.system(size: 12.5, weight: .semibold, design: .monospaced))
                    .monospacedDigit()
            }
            Spacer()
        }
        .padding(16)
    }

    private func timingRow(_ label: String, ms: UInt64, total: UInt64) -> some View {
        let ratio = total > 0 ? min(1.0, Double(ms) / Double(total)) : 0
        return VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(label)
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                Spacer()
                Text("\(ms) ms")
                    .font(.system(size: 12, design: .monospaced))
                    .monospacedDigit()
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Color.primary.opacity(0.08))
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Color.accentColor.opacity(0.75))
                        .frame(width: max(2, geo.size.width * ratio))
                }
            }
            .frame(height: 6)
        }
    }

    private var testsAndLogsView: some View {
        let passedCount = testResults.filter(\.passed).count
        let failedCount = testResults.count - passedCount

        return VStack(spacing: 0) {
            HStack(spacing: 10) {
                if !testResults.isEmpty {
                    Label("\(passedCount) Passed", systemImage: "checkmark.circle.fill")
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundStyle(.green)

                    if failedCount > 0 {
                        Label("\(failedCount) Failed", systemImage: "xmark.circle.fill")
                            .font(.system(size: 11.5, weight: .semibold))
                            .foregroundStyle(.red)
                    }
                } else {
                    Text("No Assertions")
                        .font(.system(size: 11.5))
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Text("\(scriptLogs.count) Console Log(s)")
                    .font(.system(size: 11.5, design: .monospaced))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(nsColor: .underPageBackgroundColor))

            Divider()

            if testResults.isEmpty && scriptLogs.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "checklist")
                        .font(.system(size: 24, weight: .light))
                        .foregroundStyle(.secondary)
                    Text("No Test Results or Console Logs")
                        .font(.system(size: 13, weight: .semibold))
                    Text("Write assertions with pm.test(...) or kb.test(...) in the Scripts tab.")
                        .font(.system(size: 11.5))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(24)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        if !testResults.isEmpty {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Assertions")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(.secondary)

                                ForEach(Array(testResults.enumerated()), id: \.offset) { _, result in
                                    HStack(alignment: .top, spacing: 8) {
                                        Image(systemName: result.passed ? "checkmark.circle.fill" : "xmark.circle.fill")
                                            .font(.system(size: 13))
                                            .foregroundStyle(result.passed ? .green : .red)
                                            .padding(.top, 1)

                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(result.name)
                                                .font(.system(size: 12, weight: .medium))
                                                .textSelection(.enabled)
                                            if let error = result.error, !error.isEmpty {
                                                Text(error)
                                                    .font(.system(size: 11.5, design: .monospaced))
                                                    .foregroundStyle(.red)
                                                    .textSelection(.enabled)
                                            }
                                        }
                                        Spacer()
                                    }
                                    .padding(8)
                                    .background(
                                        (result.passed ? Color.green : Color.red).opacity(0.06),
                                        in: RoundedRectangle(cornerRadius: 6)
                                    )
                                }
                            }
                        }

                        if !scriptLogs.isEmpty {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Console Output")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(.secondary)
                                scriptLogsList
                            }
                        }
                    }
                    .padding(12)
                }
            }
        }
    }

    private var scriptLogsList: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 4) {
                ForEach(Array(scriptLogs.enumerated()), id: \.offset) { _, entry in
                    HStack(alignment: .top, spacing: 8) {
                        Text(entry.level.rawValue.uppercased())
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundStyle(logLevelColor(entry.level))
                            .frame(width: 44, alignment: .leading)
                        Text(entry.message)
                            .font(.system(size: 11.5, design: .monospaced))
                            .foregroundStyle(entry.level == .error ? .red : .primary)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.primary.opacity(0.03), in: RoundedRectangle(cornerRadius: 4))
                }
            }
        }
    }

    private func logLevelColor(_ level: ScriptLogLevel) -> Color {
        switch level {
        case .log: return .secondary
        case .warn: return .orange
        case .error: return .red
        }
    }

    private func formattedBytes(_ bytes: Int) -> String {
        ByteCountFormatter.string(fromByteCount: Int64(bytes), countStyle: .file)
    }
}
