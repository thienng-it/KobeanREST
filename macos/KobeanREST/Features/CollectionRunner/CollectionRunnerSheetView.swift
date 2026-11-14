import Foundation
import Observation
import SwiftUI

struct PersistedScriptEntry: Codable, Sendable, Equatable {
    let id: String
    let entityId: String
    let entityType: String
    let scriptType: String
    let content: String
    let position: Int64
}

enum RunnerItemStatus: Sendable, Equatable {
    case pending
    case running
    case passed
    case failed
    case skipped
}

struct RunnerResultRow: Identifiable, Sendable, Equatable {
    let id: String
    let request: SavedRequest
    var status: RunnerItemStatus
    var httpStatus: UInt16?
    var statusText: String?
    var durationMs: UInt64?
    var passedAssertions: Int
    var failedAssertions: Int
    var testResults: [ScriptTestResult]
    var errorMessage: String?

    init(
        request: SavedRequest,
        status: RunnerItemStatus = .pending,
        httpStatus: UInt16? = nil,
        statusText: String? = nil,
        durationMs: UInt64? = nil,
        passedAssertions: Int = 0,
        failedAssertions: Int = 0,
        testResults: [ScriptTestResult] = [],
        errorMessage: String? = nil
    ) {
        self.id = request.id
        self.request = request
        self.status = status
        self.httpStatus = httpStatus
        self.statusText = statusText
        self.durationMs = durationMs
        self.passedAssertions = passedAssertions
        self.failedAssertions = failedAssertions
        self.testResults = testResults
        self.errorMessage = errorMessage
    }
}

@Observable
@MainActor
final class CollectionRunnerViewModel {
    static let allRequestsScopeID = "__all_requests__"

    let bridge: any CoreBridgeProtocol
    let workspace: WorkspaceSummary

    var selectedCollectionID: String
    var stopOnFailure: Bool = false
    var isRunning: Bool = false
    var results: [RunnerResultRow] = []
    var completedCount: Int = 0
    var runError: String?

    private let scriptLoader: @Sendable (URL) async -> [PersistedScriptEntry]
    private var runTask: Task<Void, Never>?

    init(
        bridge: any CoreBridgeProtocol,
        workspace: WorkspaceSummary,
        scriptLoader: (@Sendable (URL) async -> [PersistedScriptEntry])? = nil
    ) {
        self.bridge = bridge
        self.workspace = workspace
        self.selectedCollectionID = Self.allRequestsScopeID
        self.scriptLoader = scriptLoader ?? Self.defaultScriptLoader
        rebuildQueue()
    }

    var collections: [CollectionSummary] {
        workspace.collections ?? []
    }

    var progress: Double {
        guard !results.isEmpty else { return 0 }
        return Double(completedCount) / Double(results.count)
    }

    var passedCount: Int {
        results.filter { $0.status == .passed }.count
    }

    var failedCount: Int {
        results.filter { $0.status == .failed }.count
    }

    var totalAssertionsPassed: Int {
        results.reduce(0) { $0 + $1.passedAssertions }
    }

    var totalAssertionsFailed: Int {
        results.reduce(0) { $0 + $1.failedAssertions }
    }

    func rebuildQueue() {
        guard !isRunning else { return }
        let targetRequests = Self.requests(in: workspace, collectionID: selectedCollectionID)
        results = targetRequests.map { RunnerResultRow(request: $0) }
        completedCount = 0
        runError = nil
    }

    func startRun() {
        guard !isRunning else { return }
        rebuildQueue()
        guard !results.isEmpty else { return }

        isRunning = true
        runError = nil
        runTask = Task { [weak self] in
            guard let self else { return }
            await self.executeSequentialRun()
        }
    }

    func cancelRun() {
        runTask?.cancel()
        runTask = nil
        isRunning = false
        for idx in results.indices where results[idx].status == .running || results[idx].status == .pending {
            results[idx].status = .skipped
        }
    }

    func runAndWaitForTesting() async {
        startRun()
        await runTask?.value
    }

    private func executeSequentialRun() async {
        defer {
            isRunning = false
            runTask = nil
        }

        let allScripts = await scriptLoader(bridge.dataDirectoryURL)
        var variableOverrides: [String: String] = [:]
        var envVariables: [String: String] = Self.initialEnvironmentVariables(from: workspace)

        for idx in results.indices {
            if Task.isCancelled {
                markRemainingSkipped(from: idx)
                break
            }

            results[idx].status = .running
            var workingRequest = results[idx].request
            var effectiveCustomMethod: String?
            var scopedVariables = (try? await bridge.buildScopedVariableMap(
                request: workingRequest,
                workspace: workspace
            )) ?? [:]
            for (key, value) in variableOverrides {
                scopedVariables[key] = value
            }

            let requestPreScripts = Self.matchingScripts(
                allScripts,
                request: workingRequest,
                workspace: workspace,
                phase: .preRequest
            )
            let requestPostScripts = Self.matchingScripts(
                allScripts,
                request: workingRequest,
                workspace: workspace,
                phase: .postResponse
            )

            var preError: String?
            var shouldSkip = false

            for script in requestPreScripts {
                if Task.isCancelled { break }
                let snapshot = Self.makeRequestSnapshot(workingRequest, customMethod: effectiveCustomMethod)
                let preResult = await ScriptRuntime.execute(
                    ScriptExecutionInput(
                        script: script.content,
                        phase: .preRequest,
                        request: snapshot,
                        variables: scopedVariables,
                        environmentVariables: envVariables
                    )
                )
                Self.applyVariableUpdates(
                    from: preResult,
                    workspace: workspace,
                    scopedVariables: &scopedVariables,
                    variableOverrides: &variableOverrides,
                    envVariables: &envVariables
                )
                await persistEnvironmentChanges(
                    updated: preResult.updatedEnvVariables,
                    unset: preResult.unsetEnvVariables
                )
                Self.applyRequestMutations(
                    preResult.mutatedRequest,
                    to: &workingRequest,
                    customMethod: &effectiveCustomMethod
                )
                if preResult.skippedRequest {
                    shouldSkip = true
                    break
                }
                if let err = preResult.error {
                    preError = err
                    break
                }
            }

            if Task.isCancelled {
                markRemainingSkipped(from: idx)
                break
            }

            if shouldSkip {
                results[idx].status = .skipped
                completedCount += 1
                continue
            }

            if let preError {
                results[idx].status = .failed
                results[idx].errorMessage = "Pre-request script error: \(preError)"
                completedCount += 1
                if stopOnFailure {
                    markRemainingSkipped(from: idx + 1)
                    break
                }
                continue
            }

            do {
                let execution = try await bridge.prepareAndExecuteRequest(
                    request: workingRequest,
                    workspace: workspace,
                    variableOverrides: variableOverrides,
                    customMethod: effectiveCustomMethod
                )
                if Task.isCancelled {
                    markRemainingSkipped(from: idx)
                    break
                }

                let response = execution.response
                var allTestResults: [ScriptTestResult] = []
                var postError: String?

                if !requestPostScripts.isEmpty {
                    let reqSnapshot = Self.makeRequestSnapshot(
                        workingRequest,
                        customMethod: effectiveCustomMethod,
                        prepared: execution.prepared
                    )
                    let resSnapshot = Self.makeResponseSnapshot(response)

                    for script in requestPostScripts {
                        if Task.isCancelled { break }
                        let postResult = await ScriptRuntime.execute(
                            ScriptExecutionInput(
                                script: script.content,
                                phase: .postResponse,
                                request: reqSnapshot,
                                response: resSnapshot,
                                variables: scopedVariables,
                                environmentVariables: envVariables
                            )
                        )
                        Self.applyVariableUpdates(
                            from: postResult,
                            workspace: workspace,
                            scopedVariables: &scopedVariables,
                            variableOverrides: &variableOverrides,
                            envVariables: &envVariables
                        )
                        await persistEnvironmentChanges(
                            updated: postResult.updatedEnvVariables,
                            unset: postResult.unsetEnvVariables
                        )
                        allTestResults.append(contentsOf: postResult.testResults)
                        if let err = postResult.error {
                            postError = err
                            break
                        }
                    }
                }

                let passedAssertions = allTestResults.filter(\.passed).count
                let failedAssertions = allTestResults.filter { !$0.passed }.count
                let didPass: Bool = {
                    if postError != nil { return false }
                    if !allTestResults.isEmpty {
                        return failedAssertions == 0
                    }
                    return (200..<400).contains(response.status)
                }()

                results[idx].httpStatus = response.status
                results[idx].statusText = response.statusText
                results[idx].durationMs = response.durationMs
                results[idx].passedAssertions = passedAssertions
                results[idx].failedAssertions = failedAssertions
                results[idx].testResults = allTestResults
                results[idx].errorMessage = postError
                results[idx].status = didPass ? .passed : .failed
                completedCount += 1

                if !didPass && stopOnFailure {
                    markRemainingSkipped(from: idx + 1)
                    break
                }
            } catch {
                if Task.isCancelled {
                    markRemainingSkipped(from: idx)
                    break
                }
                results[idx].status = .failed
                results[idx].errorMessage = error.localizedDescription
                completedCount += 1
                if stopOnFailure {
                    markRemainingSkipped(from: idx + 1)
                    break
                }
            }
        }
    }

    private func markRemainingSkipped(from startIndex: Int) {
        guard startIndex < results.count else { return }
        for idx in startIndex..<results.count where results[idx].status == .pending || results[idx].status == .running {
            results[idx].status = .skipped
        }
    }

    // MARK: - Helpers

    static func requests(in workspace: WorkspaceSummary, collectionID: String) -> [SavedRequest] {
        guard collectionID != allRequestsScopeID else {
            return workspace.requests
        }

        var folderIDs = Set<String>()
        for folder in workspace.folders where folder.collectionId == collectionID {
            folderIDs.insert(folder.id)
        }

        var changed = true
        while changed {
            changed = false
            for folder in workspace.folders {
                if let parent = folder.parentId, folderIDs.contains(parent), folderIDs.insert(folder.id).inserted {
                    changed = true
                }
            }
        }

        return workspace.requests.filter { req in
            req.folderId == collectionID || folderIDs.contains(req.folderId)
        }
    }

    private static func initialEnvironmentVariables(from workspace: WorkspaceSummary) -> [String: String] {
        guard !workspace.activeEnvironment.isEmpty,
              let env = workspace.environments.first(where: { $0.name == workspace.activeEnvironment }) else {
            return [:]
        }
        var dict: [String: String] = [:]
        for item in env.variables {
            let hasSecretRef = item.secretRef.map { !$0.isEmpty } ?? false
            if !item.key.isEmpty && !item.secret && !hasSecretRef {
                dict[item.key] = item.value
            }
        }
        return dict
    }

    private static func normalizedScriptPhase(_ rawType: String) -> ScriptPhase? {
        switch rawType.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "pre", "pre_request":
            return .preRequest
        case "post", "post_request":
            return .postResponse
        default:
            return nil
        }
    }

    private static func matchingScripts(
        _ scripts: [PersistedScriptEntry],
        request: SavedRequest,
        workspace: WorkspaceSummary,
        phase: ScriptPhase
    ) -> [PersistedScriptEntry] {
        var orderedEntities: [(id: String, type: String)] = []
        var folderChain: [FolderSummary] = []
        var visited = Set<String>()
        var currentFolderId: String? = request.folderId.isEmpty ? nil : request.folderId
        var collectionId: String?

        while let fid = currentFolderId, !fid.isEmpty, visited.insert(fid).inserted {
            if let folder = workspace.folders.first(where: { $0.id == fid }) {
                folderChain.append(folder)
                if collectionId == nil {
                    collectionId = folder.collectionId
                }
                currentFolderId = folder.parentId
            } else {
                if collectionId == nil,
                   workspace.collections?.contains(where: { $0.id == fid }) == true {
                    collectionId = fid
                }
                break
            }
        }

        if let cid = collectionId {
            orderedEntities.append((cid, "collection"))
        }
        for folder in folderChain.reversed() {
            orderedEntities.append((folder.id, "folder"))
        }
        orderedEntities.append((request.id, "request"))

        var matched: [PersistedScriptEntry] = []
        for (entityId, entityType) in orderedEntities {
            let scoped = scripts
                .filter {
                    $0.entityId == entityId &&
                    $0.entityType == entityType &&
                    normalizedScriptPhase($0.scriptType) == phase &&
                    !$0.content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                }
                .sorted { $0.position < $1.position }
            matched.append(contentsOf: scoped)
        }
        return matched
    }

    private static func makeRequestSnapshot(
        _ request: SavedRequest,
        customMethod: String? = nil,
        prepared: PreparedHttpRequest? = nil
    ) -> ScriptRequestSnapshot {
        let headers = (prepared?.headers ?? request.headers).map {
            ScriptHeader(key: $0.key, value: $0.value, enabled: $0.enabled)
        }
        let effectiveMethod = prepared?.method
            ?? ((request.method.uppercased() == HTTPMethod.custom.rawValue ? customMethod : nil) ?? request.method)
        return ScriptRequestSnapshot(
            id: request.id,
            name: request.name,
            method: effectiveMethod,
            url: prepared?.url ?? request.url,
            headers: headers,
            body: prepared?.body ?? request.body,
            bodyMimeType: prepared?.bodyMimeType ?? request.bodyMimeType
        )
    }

    private static func makeResponseSnapshot(_ response: ExecuteHttpResponse) -> ScriptResponseSnapshot {
        ScriptResponseSnapshot(
            status: Int(response.status),
            statusText: response.statusText,
            headers: response.headers.map { ScriptHeader(key: $0.key, value: $0.value, enabled: $0.enabled) },
            body: response.bodyText ?? "",
            durationMs: Double(response.durationMs),
            sizeBytes: response.sizeBytes
        )
    }

    private static func isSecretEnvironmentVariable(_ key: String, in workspace: WorkspaceSummary) -> Bool {
        guard !workspace.activeEnvironment.isEmpty,
              let env = workspace.environments.first(where: { $0.name == workspace.activeEnvironment }),
              let existing = env.variables.first(where: { $0.key == key }) else {
            return false
        }
        return existing.secret || (existing.secretRef?.isEmpty == false)
    }

    private static func applyVariableUpdates(
        from result: ScriptExecutionResult,
        workspace: WorkspaceSummary,
        scopedVariables: inout [String: String],
        variableOverrides: inout [String: String],
        envVariables: inout [String: String]
    ) {
        for key in result.unsetVariables {
            scopedVariables.removeValue(forKey: key)
            variableOverrides.removeValue(forKey: key)
        }
        for key in result.unsetEnvVariables {
            envVariables.removeValue(forKey: key)
            scopedVariables.removeValue(forKey: key)
            variableOverrides.removeValue(forKey: key)
        }
        for (key, value) in result.updatedEnvVariables {
            variableOverrides[key] = value
            if !isSecretEnvironmentVariable(key, in: workspace) {
                envVariables[key] = value
                scopedVariables[key] = value
            }
        }
        for (key, value) in result.updatedVariables {
            scopedVariables[key] = value
            variableOverrides[key] = value
        }
    }

    private func persistEnvironmentChanges(
        updated: [String: String],
        unset: [String]
    ) async {
        let envName = workspace.activeEnvironment
        guard !envName.isEmpty, (!updated.isEmpty || !unset.isEmpty) else { return }
        let activeEnv = workspace.environments.first(where: { $0.name == envName })

        for (key, value) in updated {
            let trimmedKey = key.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmedKey.isEmpty else { continue }
            let existingVar = activeEnv?.variables.first(where: { $0.key == trimmedKey })
            let isSecret = existingVar?.secret == true || (existingVar?.secretRef?.isEmpty == false)
            if isSecret {
                _ = try? await bridge.saveSecretVariable(
                    environmentName: envName,
                    key: trimmedKey,
                    value: value,
                    scope: "env-\(envName)"
                )
            } else {
                try? await bridge.saveVariable(
                    environmentName: envName,
                    key: trimmedKey,
                    value: value,
                    masked: existingVar?.masked
                )
            }
        }

        for key in unset {
            let existingVar = activeEnv?.variables.first(where: { $0.key == key })
            try? await bridge.deleteVariable(
                environmentName: envName,
                key: key,
                secretRef: existingVar?.secretRef
            )
        }
    }

    private static func applyRequestMutations(
        _ mutated: ScriptRequestSnapshot,
        to request: inout SavedRequest,
        customMethod: inout String?
    ) {
        let upper = mutated.method.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if !upper.isEmpty {
            if let known = HTTPMethod(rawValue: upper), known != .custom {
                request.method = known.rawValue
                customMethod = nil
            } else {
                request.method = HTTPMethod.custom.rawValue
                customMethod = upper
            }
        }
        request.url = mutated.url
        request.body = mutated.body
        request.bodyMimeType = mutated.bodyMimeType
        request.headers = mutated.headers.map {
            HeaderEntry(key: $0.key, value: $0.value, enabled: $0.enabled)
        }
    }

    private static let defaultScriptLoader: @Sendable (URL) async -> [PersistedScriptEntry] = { dataDirectoryURL in
        let path = dataDirectoryURL.path
        return await Task.detached(priority: .userInitiated) {
            guard let json = try? getAllScriptsJson(dataDir: path),
                  let data = json.data(using: .utf8),
                  let decoded = try? JSONDecoder().decode([PersistedScriptEntry].self, from: data) else {
                return []
            }
            return decoded
        }.value
    }
}

struct CollectionRunnerSheetView: View {
    let bridge: any CoreBridgeProtocol
    let workspace: WorkspaceSummary

    @Environment(\.dismiss) private var dismiss
    @State private var viewModel: CollectionRunnerViewModel

    init(bridge: any CoreBridgeProtocol, workspace: WorkspaceSummary) {
        self.bridge = bridge
        self.workspace = workspace
        self._viewModel = State(initialValue: CollectionRunnerViewModel(bridge: bridge, workspace: workspace))
    }

    var body: some View {
        VStack(spacing: 0) {
            headerBar
            Divider()
            controlsBar
            Divider()
            progressSection
            Divider()
            resultsList
        }
        .frame(width: 780, height: 560)
        .onDisappear {
            viewModel.cancelRun()
        }
    }

    private var headerBar: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Collection Runner")
                    .font(.system(size: 15, weight: .semibold))
                Text("Execute requests sequentially and evaluate post-response assertions.")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Done") {
                viewModel.cancelRun()
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
            Picker("Scope", selection: $viewModel.selectedCollectionID) {
                Text("All Requests (\(workspace.requests.count))")
                    .tag(CollectionRunnerViewModel.allRequestsScopeID)
                ForEach(viewModel.collections) { col in
                    Text(col.name).tag(col.id)
                }
            }
            .frame(maxWidth: 260)
            .disabled(viewModel.isRunning)
            .onChange(of: viewModel.selectedCollectionID) { _, _ in
                viewModel.rebuildQueue()
            }

            Toggle("Stop on failure", isOn: $viewModel.stopOnFailure)
                .toggleStyle(.checkbox)
                .disabled(viewModel.isRunning)

            Spacer()

            if viewModel.isRunning {
                Button("Stop Run") {
                    viewModel.cancelRun()
                }
                .buttonStyle(.borderedProminent)
                .tint(.red)
                .controlSize(.small)
            } else {
                Button {
                    viewModel.startRun()
                } label: {
                    Label("Run (\(viewModel.results.count))", systemImage: "play.fill")
                        .font(.system(size: 12, weight: .medium))
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
                .disabled(viewModel.results.isEmpty)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color(nsColor: .underPageBackgroundColor))
    }

    private var progressSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            ProgressView(value: viewModel.progress)
                .progressViewStyle(.linear)

            HStack(spacing: 14) {
                Text("Progress: \(viewModel.completedCount)/\(viewModel.results.count)")
                    .font(.system(size: 11.5, design: .monospaced))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)

                Text("Passed: \(viewModel.passedCount)")
                    .font(.system(size: 11.5, weight: .medium, design: .monospaced))
                    .monospacedDigit()
                    .foregroundStyle(.green)

                Text("Failed: \(viewModel.failedCount)")
                    .font(.system(size: 11.5, weight: .medium, design: .monospaced))
                    .monospacedDigit()
                    .foregroundStyle(viewModel.failedCount > 0 ? .red : .secondary)

                Spacer()

                Text("Assertions: \(viewModel.totalAssertionsPassed) passed / \(viewModel.totalAssertionsFailed) failed")
                    .font(.system(size: 11.5, design: .monospaced))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }

    @ViewBuilder
    private var resultsList: some View {
        if viewModel.results.isEmpty {
            VStack(spacing: 8) {
                Image(systemName: "tray")
                    .font(.system(size: 26, weight: .light))
                    .foregroundStyle(.secondary)
                Text("No Requests in Selected Scope")
                    .font(.system(size: 13.5, weight: .semibold))
                Text("Choose All Requests or add requests to this collection.")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(viewModel.results) { row in
                        resultRow(row)
                        Divider()
                    }
                }
            }
            .background(Color(nsColor: .textBackgroundColor))
        }
    }

    private func resultRow(_ row: RunnerResultRow) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 10) {
                statusIcon(row.status)
                    .frame(width: 16)

                Text(HTTPMethod.from(row.request.method).shortLabel)
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundStyle(HTTPMethod.from(row.request.method).color)
                    .frame(width: 40, alignment: .leading)

                VStack(alignment: .leading, spacing: 1) {
                    Text(row.request.name)
                        .font(.system(size: 12.5, weight: .medium))
                        .lineLimit(1)
                    Text(row.request.url)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Spacer()

                if row.passedAssertions + row.failedAssertions > 0 {
                    Text("\(row.passedAssertions)/\(row.passedAssertions + row.failedAssertions) tests")
                        .font(.system(size: 11, design: .monospaced))
                        .monospacedDigit()
                        .foregroundStyle(row.failedAssertions > 0 ? .red : .green)
                }

                if let httpStatus = row.httpStatus {
                    let color: Color = (200..<400).contains(httpStatus) ? .green : (httpStatus < 500 ? .orange : .red)
                    Text("\(httpStatus)")
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .monospacedDigit()
                        .foregroundStyle(color)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 4))
                }

                if let durationMs = row.durationMs {
                    Text("\(durationMs) ms")
                        .font(.system(size: 11, design: .monospaced))
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                        .frame(width: 60, alignment: .trailing)
                }
            }

            if let errorMessage = row.errorMessage {
                Text(errorMessage)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(.red)
                    .padding(.leading, 26)
            }

            if !row.testResults.isEmpty {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(Array(row.testResults.enumerated()), id: \.offset) { _, test in
                        HStack(spacing: 6) {
                            Image(systemName: test.passed ? "checkmark.circle.fill" : "xmark.circle.fill")
                                .font(.system(size: 10))
                                .foregroundStyle(test.passed ? .green : .red)
                            Text(test.name)
                                .font(.system(size: 11))
                                .foregroundStyle(test.passed ? AnyShapeStyle(.secondary) : AnyShapeStyle(Color.red))
                            if let err = test.error {
                                Text("— \(err)")
                                    .font(.system(size: 10.5, design: .monospaced))
                                    .foregroundStyle(.red)
                            }
                        }
                    }
                }
                .padding(.leading, 26)
                .padding(.top, 2)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
    }

    @ViewBuilder
    private func statusIcon(_ status: RunnerItemStatus) -> some View {
        switch status {
        case .pending:
            Image(systemName: "circle")
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
        case .running:
            ProgressView()
                .controlSize(.small)
        case .passed:
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 13))
                .foregroundStyle(.green)
        case .failed:
            Image(systemName: "xmark.circle.fill")
                .font(.system(size: 13))
                .foregroundStyle(.red)
        case .skipped:
            Image(systemName: "minus.circle")
                .font(.system(size: 13))
                .foregroundStyle(.secondary)
        }
    }
}
