import AppKit
import Foundation
import Observation
import SwiftUI

struct MockRouteItem: Codable, Sendable, Identifiable, Hashable {
    var id: String
    var method: String
    var path: String
    var statusCode: UInt16
    var responseBody: String
    var contentType: String
    var delayMs: UInt32
    var enabled: Bool

    enum CodingKeys: String, CodingKey {
        case id, method, path, enabled
        case statusCode = "status_code"
        case responseBody = "response_body"
        case contentType = "content_type"
        case delayMs = "delay_ms"
    }

    init(
        id: String = UUID().uuidString,
        method: String = "GET",
        path: String = "/hello",
        statusCode: UInt16 = 200,
        responseBody: String = #"{"ok":true}"#,
        contentType: String = "application/json",
        delayMs: UInt32 = 0,
        enabled: Bool = true
    ) {
        self.id = id
        self.method = method
        self.path = path
        self.statusCode = statusCode
        self.responseBody = responseBody
        self.contentType = contentType
        self.delayMs = delayMs
        self.enabled = enabled
    }
}

struct MockRequestLogItem: Codable, Sendable, Identifiable, Hashable {
    let id: UInt64
    let timestamp: UInt64
    let method: String
    let path: String
    let matchedRouteId: String?
    let statusCode: UInt16
    let durationMs: UInt32

    enum CodingKeys: String, CodingKey {
        case id, timestamp, method, path
        case matchedRouteId = "matched_route_id"
        case statusCode = "status_code"
        case durationMs = "duration_ms"
    }
}

struct MockServerStatusItem: Codable, Sendable, Equatable {
    let running: Bool
    let port: UInt16
    let requestCount: UInt32
    let activeCollectionId: String?

    enum CodingKeys: String, CodingKey {
        case running, port
        case requestCount = "request_count"
        case activeCollectionId = "active_collection_id"
    }
}

@Observable
@MainActor
final class MockServerViewModel {
    var isRunning: Bool = false
    var portText: String = "3010"
    var activePort: UInt16 = 3010
    var requestCount: UInt32 = 0
    var activeCollectionId: String?
    var routes: [MockRouteItem] = []
    var requestLog: [MockRequestLogItem] = []
    var selectedRouteID: String?
    var errorMessage: String?
    var isBusy: Bool = false

    private let server: any FfiMockServerProtocol

    init(server: any FfiMockServerProtocol = FfiMockServer()) {
        self.server = server
    }

    var selectedRouteIndex: Int? {
        guard let selectedRouteID else { return nil }
        return routes.firstIndex(where: { $0.id == selectedRouteID })
    }

    func refreshAll() async {
        await refreshStatus()
        await loadRoutes()
        await refreshRequestLog()
    }

    func refreshStatus() async {
        let srv = server
        do {
            let json = try await Task.detached(priority: .userInitiated) {
                try srv.statusJson()
            }.value
            let status = try JSONDecoder().decode(MockServerStatusItem.self, from: Data(json.utf8))
            isRunning = status.running
            activePort = status.port
            requestCount = status.requestCount
            activeCollectionId = status.activeCollectionId
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func toggleServer() async {
        if isRunning {
            await stopServer()
        } else {
            await startServer()
        }
    }

    func startServer(activeCollectionId collectionId: String? = nil) async {
        errorMessage = nil
        guard let parsedPort = UInt16(portText.trimmingCharacters(in: .whitespacesAndNewlines)),
              parsedPort > 0 else {
            errorMessage = "Port must be an integer between 1 and 65535."
            return
        }

        isBusy = true
        defer { isBusy = false }

        let srv = server
        let targetCollection = collectionId ?? activeCollectionId
        do {
            let routesData = try JSONEncoder().encode(routes)
            let routesJson = String(data: routesData, encoding: .utf8) ?? "[]"
            let boundPort = try await Task.detached(priority: .userInitiated) {
                try srv.setRoutesJson(routesJson: routesJson)
                return try srv.start(port: parsedPort, activeCollectionId: targetCollection)
            }.value
            activePort = boundPort
            portText = String(boundPort)
            isRunning = true
            await refreshStatus()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func stopServer() async {
        errorMessage = nil
        isBusy = true
        defer { isBusy = false }

        let srv = server
        do {
            try await Task.detached(priority: .userInitiated) {
                try srv.stop()
            }.value
            isRunning = false
            await refreshStatus()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadRoutes() async {
        let srv = server
        do {
            let json = try await Task.detached(priority: .userInitiated) {
                try srv.getRoutesJson()
            }.value
            let decoded = try JSONDecoder().decode([MockRouteItem].self, from: Data(json.utf8))
            routes = decoded
            if selectedRouteID == nil {
                selectedRouteID = decoded.first?.id
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func setRoutes(_ updated: [MockRouteItem]) async {
        routes = updated
        if let selectedRouteID, !routes.contains(where: { $0.id == selectedRouteID }) {
            self.selectedRouteID = routes.first?.id
        } else if self.selectedRouteID == nil {
            self.selectedRouteID = routes.first?.id
        }
        await syncRoutesToServer()
    }

    func syncRoutesToServer() async {
        errorMessage = nil
        let srv = server
        do {
            let data = try JSONEncoder().encode(routes)
            let json = String(data: data, encoding: .utf8) ?? "[]"
            try await Task.detached(priority: .userInitiated) {
                try srv.setRoutesJson(routesJson: json)
            }.value
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func addRoute() async {
        let item = MockRouteItem(
            id: UUID().uuidString,
            method: "GET",
            path: "/resource-\(routes.count + 1)",
            statusCode: 200,
            responseBody: #"{"status":"ok"}"#,
            contentType: "application/json",
            delayMs: 0,
            enabled: true
        )
        routes.append(item)
        selectedRouteID = item.id
        await syncRoutesToServer()
    }

    func deleteRoute(id: String) async {
        routes.removeAll { $0.id == id }
        if selectedRouteID == id {
            selectedRouteID = routes.first?.id
        }
        await syncRoutesToServer()
    }

    func importRoutes(
        from requests: [SavedRequest],
        folders: [FolderSummary] = [],
        collectionId: String?
    ) async {
        let matching: [SavedRequest]
        if let collectionId, !collectionId.isEmpty {
            var folderIDs = Set<String>()
            for folder in folders where folder.collectionId == collectionId {
                folderIDs.insert(folder.id)
            }
            var changed = true
            while changed {
                changed = false
                for folder in folders {
                    if let parent = folder.parentId,
                       folderIDs.contains(parent),
                       folderIDs.insert(folder.id).inserted {
                        changed = true
                    }
                }
            }
            matching = requests.filter { req in
                req.folderId == collectionId || folderIDs.contains(req.folderId)
            }
            activeCollectionId = collectionId
        } else {
            matching = requests
        }

        let imported = matching.map { Self.mockRoute(from: $0) }
        var updated = routes
        for route in imported {
            if let existingIndex = updated.firstIndex(where: {
                $0.method.caseInsensitiveCompare(route.method) == .orderedSame && $0.path == route.path
            }) {
                updated[existingIndex] = route
            } else {
                updated.append(route)
            }
        }
        await setRoutes(updated)
    }

    func refreshRequestLog() async {
        let srv = server
        do {
            let (logJson, statusJson) = try await Task.detached(priority: .userInitiated) {
                (try srv.getRequestLogJson(), try srv.statusJson())
            }.value
            let logs = try JSONDecoder().decode([MockRequestLogItem].self, from: Data(logJson.utf8))
            let status = try JSONDecoder().decode(MockServerStatusItem.self, from: Data(statusJson.utf8))
            requestLog = logs.reversed()
            isRunning = status.running
            activePort = status.port
            requestCount = status.requestCount
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func clearRequestLog() async {
        let srv = server
        do {
            try await Task.detached(priority: .userInitiated) {
                try srv.clearRequestLog()
            }.value
            requestLog = []
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    static func mockRoute(from request: SavedRequest) -> MockRouteItem {
        let example = request.examples?.first
        let statusCode = UInt16(clamping: max(100, min(599, example?.code ?? 200)))
        let contentType = example?.bodyMimeType?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            ? (example?.bodyMimeType ?? "application/json")
            : "application/json"
        let body: String
        if let exBody = example?.body, !exBody.isEmpty {
            body = exBody
        } else {
            let escapedName = request.name.replacingOccurrences(of: "\"", with: "\\\"")
            body = #"{"mock":true,"request":"\#(escapedName)"}"#
        }

        return MockRouteItem(
            id: "route-\(request.id)",
            method: request.method.uppercased() == "CUSTOM" ? "*" : request.method.uppercased(),
            path: extractPath(from: request.url),
            statusCode: statusCode,
            responseBody: body,
            contentType: contentType,
            delayMs: 0,
            enabled: true
        )
    }

    static func extractPath(from rawURL: String) -> String {
        let trimmed = rawURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "/" }

        let withoutQuery = trimmed.split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false).first.map(String.init) ?? trimmed

        if let parsed = URL(string: withoutQuery), parsed.scheme != nil {
            let p = parsed.path
            return p.isEmpty ? "/" : p
        }

        if let schemeRange = withoutQuery.range(of: "://") {
            let afterScheme = withoutQuery[schemeRange.upperBound...]
            if let slashIdx = afterScheme.firstIndex(of: "/") {
                return String(afterScheme[slashIdx...])
            }
            return "/"
        }

        if withoutQuery.hasPrefix("{{") {
            if let slashIdx = withoutQuery.firstIndex(of: "/") {
                return String(withoutQuery[slashIdx...])
            }
            return "/"
        }

        return withoutQuery.hasPrefix("/") ? withoutQuery : "/" + withoutQuery
    }
}

struct MockServerSheetView: View {
    let collections: [CollectionSummary]
    let folders: [FolderSummary]
    let requests: [SavedRequest]

    @Environment(\.dismiss) private var dismiss
    @State private var viewModel: MockServerViewModel
    @State private var selectedCollectionID: String = ""
    @State private var copiedBaseURL: Bool = false

    private static let methodOptions = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "*", "GRPC"]
    private static let logTimeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        return formatter
    }()

    init(
        collections: [CollectionSummary],
        folders: [FolderSummary] = [],
        requests: [SavedRequest],
        initialViewModel: MockServerViewModel? = nil
    ) {
        self.collections = collections
        self.folders = folders
        self.requests = requests
        self._viewModel = State(initialValue: initialViewModel ?? MockServerViewModel())
    }

    var body: some View {
        VStack(spacing: 0) {
            headerBar
            Divider()

            if let error = viewModel.errorMessage {
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.red)
                    Text(error)
                        .font(.system(size: 11.5, design: .monospaced))
                        .foregroundStyle(.red)
                    Spacer()
                    Button {
                        viewModel.errorMessage = nil
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 10, weight: .semibold))
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 6)
                .background(Color.red.opacity(0.08))
                Divider()
            }

            VSplitView {
                HSplitView {
                    routesSidebar
                        .frame(minWidth: 230, idealWidth: 260, maxWidth: 320)
                    routeEditorPane
                        .frame(minWidth: 380)
                }
                .frame(minHeight: 280)

                requestLogPane
                    .frame(minHeight: 160, idealHeight: 190)
            }
        }
        .frame(width: 860, height: 620)
        .task {
            if selectedCollectionID.isEmpty {
                selectedCollectionID = collections.first?.id ?? ""
            }
            await viewModel.refreshAll()
        }
    }

    // MARK: - Header

    private var headerBar: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 8) {
                    Text("Local Mock Server")
                        .font(.system(size: 15, weight: .semibold))
                    statusPill
                }
                HStack(spacing: 6) {
                    Text("http://127.0.0.1:\(viewModel.isRunning ? String(viewModel.activePort) : viewModel.portText)")
                        .font(.system(size: 11.5, design: .monospaced))
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                    Button {
                        let base = "http://127.0.0.1:\(viewModel.isRunning ? String(viewModel.activePort) : viewModel.portText)"
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(base, forType: .string)
                        copiedBaseURL = true
                        Task {
                            try? await Task.sleep(for: .seconds(1.2))
                            copiedBaseURL = false
                        }
                    } label: {
                        Image(systemName: copiedBaseURL ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 10.5))
                    }
                    .buttonStyle(.plain)
                    .help("Copy Base URL")
                }
            }

            Spacer()

            HStack(spacing: 8) {
                Text("127.0.0.1 :")
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(.secondary)

                TextField("3010", text: $viewModel.portText)
                    .textFieldStyle(.roundedBorder)
                    .font(.system(size: 12, design: .monospaced))
                    .monospacedDigit()
                    .frame(width: 68)
                    .disabled(viewModel.isRunning)

                Button(viewModel.isRunning ? "Stop Server" : "Start Server") {
                    Task { await viewModel.toggleServer() }
                }
                .buttonStyle(.borderedProminent)
                .tint(viewModel.isRunning ? .red : .accentColor)
                .controlSize(.small)
                .disabled(viewModel.isBusy)

                Divider()
                    .frame(height: 18)

                Button("Done") {
                    dismiss()
                }
                .keyboardShortcut(.cancelAction)
                .controlSize(.small)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color(nsColor: .controlBackgroundColor))
    }

    private var statusPill: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(viewModel.isRunning ? Color.green : Color.secondary)
                .frame(width: 7, height: 7)
            Text(viewModel.isRunning ? "Running" : "Stopped")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(viewModel.isRunning ? .green : .secondary)
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 2)
        .background((viewModel.isRunning ? Color.green : Color.secondary).opacity(0.12), in: RoundedRectangle(cornerRadius: 4))
    }

    // MARK: - Routes List & Quick Import

    private var routesSidebar: some View {
        VStack(spacing: 0) {
            HStack(spacing: 6) {
                Text("Routes (\(viewModel.routes.count))")
                    .font(.system(size: 12.5, weight: .semibold))
                    .monospacedDigit()
                Spacer()
                Button {
                    Task { await viewModel.addRoute() }
                } label: {
                    Label("Add", systemImage: "plus")
                        .font(.system(size: 11))
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(Color(nsColor: .underPageBackgroundColor))

            Divider()

            if viewModel.routes.isEmpty {
                VStack(spacing: 8) {
                    Text("No Mock Routes")
                        .font(.system(size: 12.5, weight: .semibold))
                    Text("Add a route or import requests from a collection.")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(16)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(viewModel.routes, selection: $viewModel.selectedRouteID) { route in
                    HStack(spacing: 8) {
                        Text(route.method)
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundStyle(HTTPMethod.from(route.method).color)
                            .frame(width: 44, alignment: .leading)
                        Text(route.path)
                            .font(.system(size: 11.5, design: .monospaced))
                            .lineLimit(1)
                            .opacity(route.enabled ? 1 : 0.45)
                        Spacer()
                        Text("\(route.statusCode)")
                            .font(.system(size: 10.5, design: .monospaced))
                            .monospacedDigit()
                            .foregroundStyle(.secondary)
                    }
                    .tag(route.id)
                    .contextMenu {
                        Button("Delete Route", role: .destructive) {
                            Task { await viewModel.deleteRoute(id: route.id) }
                        }
                    }
                }
                .listStyle(.inset)
            }

            Divider()

            VStack(alignment: .leading, spacing: 6) {
                Text("Quick-Import Routes")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.secondary)
                HStack(spacing: 6) {
                    if !collections.isEmpty {
                        Picker("Collection", selection: $selectedCollectionID) {
                            ForEach(collections) { col in
                                Text(col.name).tag(col.id)
                            }
                        }
                        .labelsHidden()
                        .controlSize(.small)
                    }
                    Button("Import") {
                        Task {
                            await viewModel.importRoutes(
                                from: requests,
                                folders: folders,
                                collectionId: selectedCollectionID.isEmpty ? nil : selectedCollectionID
                            )
                        }
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    .disabled(requests.isEmpty)
                }
            }
            .padding(10)
            .background(Color(nsColor: .underPageBackgroundColor))
        }
    }

    // MARK: - Route Editor

    @ViewBuilder
    private var routeEditorPane: some View {
        if let idx = viewModel.selectedRouteIndex {
            let routeBinding = $viewModel.routes[idx]
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Toggle("Enabled", isOn: routeBinding.enabled)
                        .toggleStyle(.switch)
                        .controlSize(.small)

                    Spacer()

                    Button("Apply Changes") {
                        Task { await viewModel.syncRoutesToServer() }
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)

                    Button(role: .destructive) {
                        let id = viewModel.routes[idx].id
                        Task { await viewModel.deleteRoute(id: id) }
                    } label: {
                        Image(systemName: "trash")
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }

                HStack(spacing: 8) {
                    Picker("Method", selection: routeBinding.method) {
                        ForEach(Self.methodOptions, id: \.self) { m in
                            Text(m).tag(m)
                        }
                    }
                    .labelsHidden()
                    .frame(width: 96)

                    TextField("/users/:id", text: routeBinding.path)
                        .textFieldStyle(.roundedBorder)
                        .font(.system(size: 12, design: .monospaced))

                    Text("Status")
                        .font(.system(size: 11.5))
                        .foregroundStyle(.secondary)

                    TextField("200", value: routeBinding.statusCode, format: .number.grouping(.never))
                        .textFieldStyle(.roundedBorder)
                        .font(.system(size: 12, design: .monospaced))
                        .monospacedDigit()
                        .frame(width: 62)
                }

                HStack(spacing: 8) {
                    Text("Content-Type")
                        .font(.system(size: 11.5))
                        .foregroundStyle(.secondary)
                    TextField("application/json", text: routeBinding.contentType)
                        .textFieldStyle(.roundedBorder)
                        .font(.system(size: 12, design: .monospaced))

                    Text("Delay (ms)")
                        .font(.system(size: 11.5))
                        .foregroundStyle(.secondary)
                    TextField("0", value: routeBinding.delayMs, format: .number.grouping(.never))
                        .textFieldStyle(.roundedBorder)
                        .font(.system(size: 12, design: .monospaced))
                        .monospacedDigit()
                        .frame(width: 66)
                }

                Text("Response Body")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(.secondary)

                TextEditor(text: routeBinding.responseBody)
                    .font(.system(size: 12, design: .monospaced))
                    .scrollContentBackground(.hidden)
                    .padding(6)
                    .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 6))
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(Color.primary.opacity(0.10), lineWidth: 1)
                    )
            }
            .padding(12)
            .onChange(of: viewModel.routes[idx]) { _, _ in
                Task { await viewModel.syncRoutesToServer() }
            }
        } else {
            VStack(spacing: 8) {
                Text("Select a route to configure")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    // MARK: - Request Log Inspector

    private var requestLogPane: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Text("Request Log (\(viewModel.requestLog.count))")
                    .font(.system(size: 12.5, weight: .semibold))
                    .monospacedDigit()
                Text("Total Hits: \(viewModel.requestCount)")
                    .font(.system(size: 11, design: .monospaced))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                Spacer()
                Button {
                    Task { await viewModel.refreshRequestLog() }
                } label: {
                    Label("Refresh", systemImage: "arrow.clockwise")
                        .font(.system(size: 11))
                }
                .buttonStyle(.bordered)
                .controlSize(.small)

                Button {
                    Task { await viewModel.clearRequestLog() }
                } label: {
                    Label("Clear", systemImage: "trash")
                        .font(.system(size: 11))
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .disabled(viewModel.requestLog.isEmpty)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color(nsColor: .underPageBackgroundColor))

            Divider()

            if viewModel.requestLog.isEmpty {
                Text("No incoming requests logged yet.")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(viewModel.requestLog) { entry in
                            HStack(spacing: 10) {
                                Text(Self.logTimeFormatter.string(from: Date(timeIntervalSince1970: TimeInterval(entry.timestamp) / 1000.0)))
                                    .font(.system(size: 11, design: .monospaced))
                                    .monospacedDigit()
                                    .foregroundStyle(.secondary)
                                    .frame(width: 64, alignment: .leading)

                                Text(entry.method)
                                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                    .foregroundStyle(HTTPMethod.from(entry.method).color)
                                    .frame(width: 48, alignment: .leading)

                                Text(entry.path)
                                    .font(.system(size: 11.5, design: .monospaced))
                                    .lineLimit(1)

                                Spacer()

                                Text(entry.matchedRouteId == nil ? "UNMATCHED" : "MATCHED")
                                    .font(.system(size: 10, weight: .semibold, design: .monospaced))
                                    .foregroundStyle(entry.matchedRouteId == nil ? .orange : .green)

                                Text("\(entry.statusCode)")
                                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                    .monospacedDigit()
                                    .foregroundStyle((200..<400).contains(entry.statusCode) ? .green : .orange)
                                    .frame(width: 34, alignment: .trailing)

                                Text("\(entry.durationMs) ms")
                                    .font(.system(size: 11, design: .monospaced))
                                    .monospacedDigit()
                                    .foregroundStyle(.secondary)
                                    .frame(width: 56, alignment: .trailing)
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 5)
                            Divider()
                        }
                    }
                }
                .background(Color(nsColor: .textBackgroundColor))
            }
        }
    }
}
