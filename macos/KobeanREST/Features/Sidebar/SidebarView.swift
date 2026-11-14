import SwiftUI

struct SidebarView: View {
    @Bindable var appState: AppState

    @State private var promptAction: SidebarPromptAction?
    @State private var promptText: String = ""

    private enum SidebarPromptAction: Identifiable {
        case createWorkspace
        case createCollection
        case renameCollection(CollectionSummary)
        case createFolder(collectionId: String?, parentId: String?)
        case renameFolder(FolderSummary)

        var id: String {
            switch self {
            case .createWorkspace: return "createWorkspace"
            case .createCollection: return "createCollection"
            case .renameCollection(let c): return "renameCollection-\(c.id)"
            case .createFolder(let cid, let pid): return "createFolder-\(cid ?? "")-\(pid ?? "")"
            case .renameFolder(let f): return "renameFolder-\(f.id)"
            }
        }

        var title: String {
            switch self {
            case .createWorkspace: return "New Workspace"
            case .createCollection: return "New Collection"
            case .renameCollection: return "Rename Collection"
            case .createFolder: return "New Folder"
            case .renameFolder: return "Rename Folder"
            }
        }

        var placeholder: String {
            switch self {
            case .createWorkspace: return "Workspace name"
            case .createCollection, .renameCollection: return "Collection name"
            case .createFolder, .renameFolder: return "Folder name"
            }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            workspaceHeader
            Divider()
            sectionAndSearchBar
            Divider()

            switch appState.sidebarSection {
            case .collections:
                collectionsList
            case .history:
                historyList
            }
        }
        .background(Color(nsColor: .controlBackgroundColor).opacity(0.4))
        .sheet(item: $promptAction) { action in
            namePromptSheet(for: action)
        }
    }

    private var workspaceHeader: some View {
        HStack(spacing: 8) {
            Menu {
                ForEach(appState.workspaces) { ws in
                    Button {
                        Task { await appState.switchWorkspace(id: ws.id) }
                    } label: {
                        HStack {
                            Text(ws.name)
                            if ws.id == appState.workspace?.id {
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                }
                Divider()
                Button("New Workspace…") {
                    promptText = ""
                    promptAction = .createWorkspace
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "square.stack.3d.up")
                        .foregroundStyle(.secondary)
                    Text(appState.workspace?.name ?? "Workspace")
                        .font(.system(size: 13, weight: .semibold))
                        .lineLimit(1)
                    Spacer()
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .background(Color.primary.opacity(0.05), in: RoundedRectangle(cornerRadius: 6))
            }
            .menuStyle(.borderlessButton)

            Button {
                appState.createNewTab()
            } label: {
                Image(systemName: "plus")
            }
            .buttonStyle(.borderless)
            .help("New Request Tab (⌘T)")
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
    }

    private var sectionAndSearchBar: some View {
        VStack(spacing: 8) {
            Picker("Sidebar Section", selection: $appState.sidebarSection) {
                ForEach(SidebarSection.allCases) { section in
                    Text(section.rawValue).tag(section)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()

            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                TextField("Filter requests…", text: $appState.searchQuery)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12))
                if !appState.searchQuery.isEmpty {
                    Button {
                        appState.searchQuery = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 6))
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(Color.primary.opacity(0.10), lineWidth: 1)
            )
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
    }

    @ViewBuilder
    private var collectionsList: some View {
        let workspace = appState.workspace
        let collections = workspace?.collections ?? []
        let folders = workspace?.folders ?? []
        let requests = filteredRequests(workspace?.requests ?? [])

        if collections.isEmpty && folders.isEmpty && requests.isEmpty {
            emptyCollectionsState
        } else {
            List {
                ForEach(collections) { collection in
                    CollectionSectionView(
                        collection: collection,
                        allFolders: folders,
                        allRequests: requests,
                        selectedRequestID: appState.activeTab?.request.id,
                        onSelectRequest: { appState.openRequest($0) },
                        onNewRequest: { folderId in
                            Task { await appState.createRequestInFolder(folderId: folderId) }
                        },
                        onNewFolder: { cid, pid in
                            promptText = ""
                            promptAction = .createFolder(collectionId: cid, parentId: pid)
                        },
                        onRenameCollection: { col in
                            promptText = col.name
                            promptAction = .renameCollection(col)
                        },
                        onDeleteCollection: { col in
                            Task { await appState.deleteCollection(id: col.id) }
                        },
                        onRenameFolder: { folder in
                            promptText = folder.name
                            promptAction = .renameFolder(folder)
                        },
                        onDeleteFolder: { folder in
                            Task { await appState.deleteFolder(id: folder.id) }
                        },
                        onDeleteRequest: { req in
                            Task { await appState.deleteRequest(id: req.id) }
                        }
                    )
                }

                // Standalone folders without a matching collection
                let collectionIDs = Set(collections.map(\.id))
                let orphanFolders = folders.filter { folder in
                    (folder.parentId ?? "").isEmpty &&
                    !collectionIDs.contains(folder.collectionId ?? "")
                }
                ForEach(orphanFolders) { folder in
                    FolderTreeView(
                        folder: folder,
                        allFolders: folders,
                        allRequests: requests,
                        selectedRequestID: appState.activeTab?.request.id,
                        onSelectRequest: { appState.openRequest($0) },
                        onNewRequest: { fid in
                            Task { await appState.createRequestInFolder(folderId: fid) }
                        },
                        onNewSubfolder: { pid in
                            promptText = ""
                            promptAction = .createFolder(collectionId: folder.collectionId, parentId: pid)
                        },
                        onRenameFolder: { f in
                            promptText = f.name
                            promptAction = .renameFolder(f)
                        },
                        onDeleteFolder: { f in
                            Task { await appState.deleteFolder(id: f.id) }
                        },
                        onDeleteRequest: { req in
                            Task { await appState.deleteRequest(id: req.id) }
                        }
                    )
                }

                // Unfiled requests
                let knownContainerIDs = Set(collections.map(\.id)).union(folders.map(\.id))
                let unfiled = requests.filter { !knownContainerIDs.contains($0.folderId) }
                if !unfiled.isEmpty {
                    Section("Requests") {
                        ForEach(unfiled) { req in
                            SidebarRequestRow(
                                request: req,
                                isSelected: appState.activeTab?.request.id == req.id,
                                onSelect: { appState.openRequest(req) },
                                onDelete: { Task { await appState.deleteRequest(id: req.id) } }
                            )
                        }
                    }
                }
            }
            .listStyle(.sidebar)
            .contextMenu {
                Button("New Collection…") {
                    promptText = ""
                    promptAction = .createCollection
                }
                Button("New Request Tab") {
                    appState.createNewTab()
                }
            }
        }
    }

    private var emptyCollectionsState: some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: "tray")
                .font(.system(size: 28, weight: .light))
                .foregroundStyle(.secondary)
            Text(appState.searchQuery.isEmpty ? "No Collections Yet" : "No Matching Requests")
                .font(.system(size: 13, weight: .semibold))
            Text(
                appState.searchQuery.isEmpty
                    ? "Create a collection or import Postman, OpenAPI, or cURL definitions."
                    : "Try clearing your search filter."
            )
            .font(.system(size: 11))
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 20)

            HStack(spacing: 8) {
                if appState.searchQuery.isEmpty {
                    Button("New Collection") {
                        promptText = ""
                        promptAction = .createCollection
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)

                    Button("Import…") {
                        appState.isImportSheetPresented = true
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                } else {
                    Button("Clear Filter") {
                        appState.searchQuery = ""
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
            }
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private var historyList: some View {
        let filtered = filteredHistory(appState.history)
        VStack(spacing: 0) {
            if !appState.history.isEmpty {
                HStack {
                    Text("\(filtered.count) entries")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                    Spacer()
                    Button("Clear") {
                        Task { await appState.clearHistory() }
                    }
                    .buttonStyle(.borderless)
                    .font(.system(size: 11, weight: .medium))
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                Divider()
            }

            if filtered.isEmpty {
                VStack(spacing: 8) {
                    Spacer()
                    Image(systemName: "clock")
                        .font(.system(size: 26, weight: .light))
                        .foregroundStyle(.secondary)
                    Text("No History")
                        .font(.system(size: 13, weight: .semibold))
                    Text("Executed requests appear here with redacted credentials.")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 20)
                    Spacer()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(filtered) { entry in
                    Button {
                        Task { await appState.openHistoryEntry(entry) }
                    } label: {
                        VStack(alignment: .leading, spacing: 3) {
                            HStack(spacing: 6) {
                                MethodBadge(method: entry.method)
                                Text("\(entry.status)")
                                    .font(.system(size: 10, weight: .semibold, design: .monospaced))
                                    .monospacedDigit()
                                    .foregroundStyle(statusColor(for: entry.status))
                                Spacer()
                                Text("\(entry.durationMs) ms")
                                    .font(.system(size: 10, design: .monospaced))
                                    .monospacedDigit()
                                    .foregroundStyle(.secondary)
                            }
                            Text(entry.url)
                                .font(.system(size: 11, design: .monospaced))
                                .lineLimit(1)
                                .truncationMode(.middle)
                                .foregroundStyle(.primary)
                        }
                        .padding(.vertical, 2)
                    }
                    .buttonStyle(.plain)
                }
                .listStyle(.sidebar)
            }
        }
    }

    private func filteredRequests(_ requests: [SavedRequest]) -> [SavedRequest] {
        let q = appState.searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return requests }
        return requests.filter {
            $0.name.lowercased().contains(q)
                || $0.url.lowercased().contains(q)
                || $0.method.lowercased().contains(q)
        }
    }

    private func filteredHistory(_ entries: [HistoryEntry]) -> [HistoryEntry] {
        let q = appState.searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return entries }
        return entries.filter {
            $0.url.lowercased().contains(q)
                || $0.method.lowercased().contains(q)
                || String($0.status).contains(q)
        }
    }

    private func statusColor(for status: Int64) -> Color {
        switch status {
        case 200..<300: return .green
        case 300..<400: return .teal
        case 400..<500: return .orange
        default: return .red
        }
    }

    private func namePromptSheet(for action: SidebarPromptAction) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(action.title)
                .font(.system(size: 15, weight: .semibold))
            TextField(action.placeholder, text: $promptText)
                .textFieldStyle(.roundedBorder)
                .onSubmit {
                    submitPrompt(action)
                }
            HStack {
                Spacer()
                Button("Cancel") {
                    promptAction = nil
                }
                .keyboardShortcut(.cancelAction)
                Button("Save") {
                    submitPrompt(action)
                }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.defaultAction)
                .disabled(promptText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(20)
        .frame(width: 340)
    }

    private func submitPrompt(_ action: SidebarPromptAction) {
        let name = promptText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        promptAction = nil

        Task {
            switch action {
            case .createWorkspace:
                await appState.createWorkspace(name: name)
            case .createCollection:
                await appState.createCollection(name: name)
            case .renameCollection(let col):
                await appState.renameCollection(id: col.id, name: name)
            case .createFolder(let cid, let pid):
                await appState.createFolder(name: name, collectionId: cid, parentId: pid)
            case .renameFolder(let folder):
                await appState.renameFolder(id: folder.id, name: name)
            }
        }
    }
}

private struct CollectionSectionView: View {
    let collection: CollectionSummary
    let allFolders: [FolderSummary]
    let allRequests: [SavedRequest]
    let selectedRequestID: String?
    let onSelectRequest: (SavedRequest) -> Void
    let onNewRequest: (String) -> Void
    let onNewFolder: (String?, String?) -> Void
    let onRenameCollection: (CollectionSummary) -> Void
    let onDeleteCollection: (CollectionSummary) -> Void
    let onRenameFolder: (FolderSummary) -> Void
    let onDeleteFolder: (FolderSummary) -> Void
    let onDeleteRequest: (SavedRequest) -> Void

    @State private var isExpanded: Bool = true

    var body: some View {
        let rootFolders = allFolders.filter {
            $0.collectionId == collection.id && ($0.parentId ?? "").isEmpty
        }
        let directRequests = allRequests.filter { $0.folderId == collection.id }

        DisclosureGroup(isExpanded: $isExpanded) {
            ForEach(rootFolders) { folder in
                FolderTreeView(
                    folder: folder,
                    allFolders: allFolders,
                    allRequests: allRequests,
                    selectedRequestID: selectedRequestID,
                    onSelectRequest: onSelectRequest,
                    onNewRequest: onNewRequest,
                    onNewSubfolder: { pid in onNewFolder(collection.id, pid) },
                    onRenameFolder: onRenameFolder,
                    onDeleteFolder: onDeleteFolder,
                    onDeleteRequest: onDeleteRequest
                )
            }
            ForEach(directRequests) { req in
                SidebarRequestRow(
                    request: req,
                    isSelected: selectedRequestID == req.id,
                    onSelect: { onSelectRequest(req) },
                    onDelete: { onDeleteRequest(req) }
                )
            }
        } label: {
            Label(collection.name, systemImage: "folder.badge.gearshape")
                .font(.system(size: 13, weight: .semibold))
                .contextMenu {
                    Button("New Request") { onNewRequest(collection.id) }
                    Button("New Folder…") { onNewFolder(collection.id, nil) }
                    Divider()
                    Button("Rename…") { onRenameCollection(collection) }
                    Button("Delete", role: .destructive) { onDeleteCollection(collection) }
                }
        }
    }
}

private struct FolderTreeView: View {
    let folder: FolderSummary
    let allFolders: [FolderSummary]
    let allRequests: [SavedRequest]
    let selectedRequestID: String?
    let onSelectRequest: (SavedRequest) -> Void
    let onNewRequest: (String) -> Void
    let onNewSubfolder: (String) -> Void
    let onRenameFolder: (FolderSummary) -> Void
    let onDeleteFolder: (FolderSummary) -> Void
    let onDeleteRequest: (SavedRequest) -> Void

    @State private var isExpanded: Bool = true

    var body: some View {
        let childFolders = allFolders.filter { $0.parentId == folder.id }
        let childRequests = allRequests.filter { $0.folderId == folder.id }

        DisclosureGroup(isExpanded: $isExpanded) {
            ForEach(childFolders) { sub in
                FolderTreeView(
                    folder: sub,
                    allFolders: allFolders,
                    allRequests: allRequests,
                    selectedRequestID: selectedRequestID,
                    onSelectRequest: onSelectRequest,
                    onNewRequest: onNewRequest,
                    onNewSubfolder: onNewSubfolder,
                    onRenameFolder: onRenameFolder,
                    onDeleteFolder: onDeleteFolder,
                    onDeleteRequest: onDeleteRequest
                )
            }
            ForEach(childRequests) { req in
                SidebarRequestRow(
                    request: req,
                    isSelected: selectedRequestID == req.id,
                    onSelect: { onSelectRequest(req) },
                    onDelete: { onDeleteRequest(req) }
                )
            }
        } label: {
            Label(folder.name, systemImage: "folder")
                .font(.system(size: 12.5, weight: .medium))
                .contextMenu {
                    Button("New Request") { onNewRequest(folder.id) }
                    Button("New Subfolder…") { onNewSubfolder(folder.id) }
                    Divider()
                    Button("Rename…") { onRenameFolder(folder) }
                    Button("Delete", role: .destructive) { onDeleteFolder(folder) }
                }
        }
    }
}

private struct SidebarRequestRow: View {
    let request: SavedRequest
    let isSelected: Bool
    let onSelect: () -> Void
    let onDelete: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 6) {
                MethodBadge(method: request.method)
                Text(request.name)
                    .font(.system(size: 12.5))
                    .lineLimit(1)
                    .truncationMode(.tail)
                Spacer()
            }
            .padding(.vertical, 2)
            .padding(.horizontal, 4)
            .background(
                isSelected ? Color.accentColor.opacity(0.14) : Color.clear,
                in: RoundedRectangle(cornerRadius: 5)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button("Open in Tab") { onSelect() }
            Divider()
            Button("Delete", role: .destructive) { onDelete() }
        }
    }
}

struct MethodBadge: View {
    let method: String

    var body: some View {
        let parsed = HTTPMethod.from(method)
        Text(parsed.shortLabel)
            .font(.system(size: 9.5, weight: .bold, design: .monospaced))
            .foregroundStyle(parsed.color)
            .frame(width: 34, alignment: .leading)
    }
}
