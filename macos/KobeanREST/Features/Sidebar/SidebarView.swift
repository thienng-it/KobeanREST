import AppKit
import SwiftUI

struct SidebarView: View {
    @Bindable var appState: AppState

    @State private var promptAction: SidebarPromptAction?
    @State private var promptText: String = ""

    @State private var selectedNodeID: SidebarNodeID?
    @State private var hoveredNodeID: SidebarNodeID?
    @State private var renamingNodeID: SidebarNodeID?
    @State private var renameDraft: String = ""
    @State private var renameCancelled: Bool = false
    @State private var pendingSelectAllRename: Bool = false

    @FocusState private var isSidebarListFocused: Bool
    @FocusState private var focusedRenameNodeID: SidebarNodeID?

    private enum SidebarPromptAction: Identifiable {
        case createWorkspace
        case createCollection
        case createFolder(collectionId: String?, parentId: String?)

        var id: String {
            switch self {
            case .createWorkspace: return "createWorkspace"
            case .createCollection: return "createCollection"
            case .createFolder(let cid, let pid): return "createFolder-\(cid ?? "")-\(pid ?? "")"
            }
        }

        var title: String {
            switch self {
            case .createWorkspace: return "New Workspace"
            case .createCollection: return "New Collection"
            case .createFolder: return "New Folder"
            }
        }

        var placeholder: String {
            switch self {
            case .createWorkspace: return "Workspace name"
            case .createCollection: return "Collection name"
            case .createFolder: return "Folder name"
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
        .onChange(of: focusedRenameNodeID) { oldValue, newValue in
            if let oldValue, newValue != oldValue, renamingNodeID == oldValue, !renameCancelled {
                commitRename()
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: NSText.didBeginEditingNotification)) { notification in
            guard pendingSelectAllRename,
                  renamingNodeID != nil,
                  let textView = notification.object as? NSTextView,
                  textView.string == renameDraft else {
                return
            }
            pendingSelectAllRename = false
            textView.selectAll(nil)
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

                if appState.sidebarSection == .collections {
                    let allCollapsed = appState.areAllSidebarNodesCollapsed
                    let hasContainers = !appState.allCollapsibleSidebarNodeIDs.isEmpty
                    let isSearching = !appState.searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty

                    Button {
                        withAnimation(.easeInOut(duration: 0.16)) {
                            appState.toggleCollapseExpandAll()
                        }
                    } label: {
                        Image(systemName: allCollapsed ? "rectangle.expand.vertical" : "rectangle.compress.vertical")
                            .font(.system(size: 11.5, weight: .medium))
                            .foregroundStyle(hasContainers && !isSearching ? .secondary : .tertiary)
                            .frame(width: 26, height: 26)
                            .background(Color.primary.opacity(0.05), in: RoundedRectangle(cornerRadius: 6))
                    }
                    .buttonStyle(.plain)
                    .disabled(!hasContainers || isSearching)
                    .help(allCollapsed ? "Expand All Folders" : "Collapse All Folders")
                    .accessibilityLabel(allCollapsed ? "Expand All Folders" : "Collapse All Folders")
                }
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
    }

    @ViewBuilder
    private var collectionsList: some View {
        let rows = SidebarTreeBuilder.buildRows(
            workspace: appState.workspace,
            collapsedNodeIDs: appState.collapsedSidebarNodeIDs,
            searchQuery: appState.searchQuery
        )

        if rows.isEmpty {
            emptyCollectionsState
        } else {
            List(rows, id: \.id, selection: $selectedNodeID) { row in
                sidebarRowView(row)
                    .tag(row.id)
                    .selectionDisabled(!row.isRenameable)
                    .listRowInsets(EdgeInsets(top: 1, leading: 6, bottom: 1, trailing: 6))
                    .listRowSeparator(.hidden)
            }
            .listStyle(.sidebar)
            .focused($isSidebarListFocused)
            .onChange(of: selectedNodeID) { _, newSelection in
                handleSelectionChange(newSelection, rows: rows)
            }
            .onChange(of: appState.activeTab?.request.id) { _, activeRequestID in
                guard renamingNodeID == nil else { return }
                if let activeRequestID,
                   rows.contains(where: { $0.id == .request(activeRequestID) }) {
                    selectedNodeID = .request(activeRequestID)
                }
            }
            .onChange(of: appState.workspace?.id) { _, _ in
                cancelRename(restoreListFocus: false)
                selectedNodeID = nil
            }
            .onKeyPress(.return) {
                guard isSidebarListFocused,
                      renamingNodeID == nil,
                      let targetID = selectedNodeID,
                      let targetRow = rows.first(where: { $0.id == targetID }),
                      targetRow.isRenameable else {
                    return .ignored
                }
                beginRename(for: targetRow)
                return .handled
            }
            .onKeyPress(.leftArrow) {
                handleLeftArrow(rows: rows)
            }
            .onKeyPress(.rightArrow) {
                handleRightArrow(rows: rows)
            }
            .contextMenu {
                Button("New Collection…") {
                    promptText = ""
                    promptAction = .createCollection
                }
                Button("New Request Tab") {
                    appState.createNewTab()
                }
                if !appState.allCollapsibleSidebarNodeIDs.isEmpty {
                    Divider()
                    Button(appState.areAllSidebarNodesCollapsed ? "Expand All" : "Collapse All") {
                        withAnimation(.easeInOut(duration: 0.16)) {
                            appState.toggleCollapseExpandAll()
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func sidebarRowView(_ row: SidebarTreeRow) -> some View {
        let indent = CGFloat(row.depth) * 14
        let isRenaming = renamingNodeID == row.id

        switch row.kind {
        case .sectionHeader(let title):
            Text(title)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.secondary)
                .padding(.top, 6)
                .padding(.bottom, 2)
                .padding(.leading, 4)

        case .collection(let collection):
            let folderIDs = SidebarTreeBuilder.folderNodeIDs(inCollection: collection.id, workspace: appState.workspace)
            let hasFolders = !folderIDs.isEmpty
            let allFoldersCollapsed = hasFolders && folderIDs.isSubset(of: appState.collapsedSidebarNodeIDs)
            let isSearching = !appState.searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            let showFolderToggle = hasFolders && !isRenaming && !isSearching
                && (hoveredNodeID == row.id || selectedNodeID == row.id || allFoldersCollapsed)

            HStack(spacing: 4) {
                disclosureButton(for: row)
                Image(systemName: "folder.badge.gearshape")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                rowNameContent(
                    row: row,
                    isRenaming: isRenaming,
                    font: .system(size: 13, weight: .semibold)
                )
                Spacer(minLength: 4)
                if showFolderToggle {
                    Button {
                        withAnimation(.easeInOut(duration: 0.16)) {
                            appState.toggleCollapseExpandFolders(inCollection: collection.id)
                        }
                    } label: {
                        Image(systemName: allFoldersCollapsed ? "rectangle.expand.vertical" : "rectangle.compress.vertical")
                            .font(.system(size: 10.5, weight: .medium))
                            .foregroundStyle(selectedNodeID == row.id ? AnyShapeStyle(.white.opacity(0.9)) : AnyShapeStyle(.secondary))
                            .frame(width: 20, height: 20)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .help(allFoldersCollapsed
                          ? "Expand All Folders in \(collection.name)"
                          : "Collapse All Folders in \(collection.name)")
                    .accessibilityLabel(allFoldersCollapsed
                                        ? "Expand All Folders in \(collection.name)"
                                        : "Collapse All Folders in \(collection.name)")
                }
            }
            .padding(.leading, indent)
            .padding(.vertical, 3)
            .contentShape(Rectangle())
            .onHover { isHovering in
                if isHovering {
                    hoveredNodeID = row.id
                } else if hoveredNodeID == row.id {
                    hoveredNodeID = nil
                }
            }
            .contextMenu {
                Button("New Request") {
                    Task { await appState.createRequestInFolder(folderId: collection.id) }
                }
                Button("New Folder…") {
                    promptText = ""
                    promptAction = .createFolder(collectionId: collection.id, parentId: nil)
                }
                if hasFolders {
                    Divider()
                    Button(allFoldersCollapsed ? "Expand All Folders" : "Collapse All Folders") {
                        withAnimation(.easeInOut(duration: 0.16)) {
                            appState.toggleCollapseExpandFolders(inCollection: collection.id)
                        }
                    }
                }
                Divider()
                Button("Rename") {
                    beginRename(for: row)
                }
                Button("Delete", role: .destructive) {
                    Task { await appState.deleteCollection(id: collection.id) }
                }
            }

        case .folder(let folder, _):
            HStack(spacing: 4) {
                disclosureButton(for: row)
                Image(systemName: "folder")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                rowNameContent(
                    row: row,
                    isRenaming: isRenaming,
                    font: .system(size: 12.5, weight: .medium)
                )
                Spacer(minLength: 0)
            }
            .padding(.leading, indent)
            .padding(.vertical, 3)
            .contentShape(Rectangle())
            .contextMenu {
                Button("New Request") {
                    Task { await appState.createRequestInFolder(folderId: folder.id) }
                }
                Button("New Subfolder…") {
                    promptText = ""
                    promptAction = .createFolder(collectionId: folder.collectionId, parentId: folder.id)
                }
                Divider()
                Button("Rename") {
                    beginRename(for: row)
                }
                Button("Delete", role: .destructive) {
                    Task { await appState.deleteFolder(id: folder.id) }
                }
            }

        case .request(let req):
            HStack(spacing: 6) {
                Color.clear
                    .frame(width: 14, height: 14)
                MethodBadge(method: req.method)
                rowNameContent(
                    row: row,
                    isRenaming: isRenaming,
                    font: .system(size: 12.5)
                )
                Spacer(minLength: 0)
            }
            .padding(.leading, indent)
            .padding(.vertical, 2)
            .contentShape(Rectangle())
            .contextMenu {
                Button("Open in Tab") {
                    selectedNodeID = row.id
                    appState.openRequest(req)
                }
                Button("Duplicate") {
                    Task { await appState.duplicateRequest(id: req.id) }
                }
                Button("Rename") {
                    beginRename(for: row)
                }
                Divider()
                Button("Delete", role: .destructive) {
                    Task { await appState.deleteRequest(id: req.id) }
                }
            }
        }
    }

    private func disclosureButton(for row: SidebarTreeRow) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.16)) {
                appState.setSidebarNodeExpanded(row.id, expanded: !row.isExpanded)
            }
        } label: {
            Image(systemName: "chevron.right")
                .font(.system(size: 9.5, weight: .semibold))
                .foregroundStyle(.secondary)
                .rotationEffect(.degrees(row.isExpanded ? 90 : 0))
                .frame(width: 14, height: 14)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(row.isExpanded ? "Collapse \(row.displayName)" : "Expand \(row.displayName)")
    }

    @ViewBuilder
    private func rowNameContent(row: SidebarTreeRow, isRenaming: Bool, font: Font) -> some View {
        if isRenaming {
            TextField("Name", text: $renameDraft)
                .textFieldStyle(.plain)
                .font(font)
                .padding(.horizontal, 4)
                .padding(.vertical, 1)
                .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 4))
                .overlay(
                    RoundedRectangle(cornerRadius: 4)
                        .stroke(Color.accentColor, lineWidth: 1.5)
                )
                .focused($focusedRenameNodeID, equals: row.id)
                .onSubmit {
                    commitRename()
                }
                .onExitCommand {
                    cancelRename(restoreListFocus: true)
                }
        } else {
            Text(row.displayName)
                .font(font)
                .lineLimit(1)
                .truncationMode(.tail)
        }
    }

    private func handleSelectionChange(_ newSelection: SidebarNodeID?, rows: [SidebarTreeRow]) {
        guard let newSelection else { return }
        if case .request(let requestID) = newSelection,
           let row = rows.first(where: { $0.id == .request(requestID) }),
           case .request(let request) = row.kind {
            if appState.activeTab?.request.id != request.id {
                appState.openRequest(request)
            }
        }
    }

    private func handleLeftArrow(rows: [SidebarTreeRow]) -> KeyPress.Result {
        guard isSidebarListFocused,
              renamingNodeID == nil,
              let currentID = selectedNodeID,
              let row = rows.first(where: { $0.id == currentID }) else {
            return .ignored
        }

        if row.isCollapsible && row.isExpanded {
            withAnimation(.easeInOut(duration: 0.16)) {
                appState.setSidebarNodeExpanded(row.id, expanded: false)
            }
            return .handled
        }

        if let parentID = row.parentContainerID,
           rows.contains(where: { $0.id == parentID && $0.isRenameable }) {
            selectedNodeID = parentID
            return .handled
        }

        return .ignored
    }

    private func handleRightArrow(rows: [SidebarTreeRow]) -> KeyPress.Result {
        guard isSidebarListFocused,
              renamingNodeID == nil,
              let currentID = selectedNodeID,
              let row = rows.first(where: { $0.id == currentID }),
              row.isCollapsible else {
            return .ignored
        }

        if !row.isExpanded {
            withAnimation(.easeInOut(duration: 0.16)) {
                appState.setSidebarNodeExpanded(row.id, expanded: true)
            }
            return .handled
        }

        if let idx = rows.firstIndex(where: { $0.id == currentID }),
           idx + 1 < rows.count,
           rows[idx + 1].parentContainerID == currentID {
            selectedNodeID = rows[idx + 1].id
            return .handled
        }

        return .ignored
    }

    private func beginRename(for row: SidebarTreeRow) {
        guard row.isRenameable else { return }
        selectedNodeID = row.id
        renameCancelled = false
        renameDraft = row.displayName
        pendingSelectAllRename = true
        renamingNodeID = row.id

        Task { @MainActor in
            focusedRenameNodeID = row.id
        }
    }

    private func cancelRename(restoreListFocus: Bool) {
        renameCancelled = true
        pendingSelectAllRename = false
        renamingNodeID = nil
        focusedRenameNodeID = nil
        renameDraft = ""
        if restoreListFocus {
            isSidebarListFocused = true
        }
    }

    private func commitRename() {
        guard let targetID = renamingNodeID else { return }
        let trimmed = renameDraft.trimmingCharacters(in: .whitespacesAndNewlines)

        renameCancelled = true
        pendingSelectAllRename = false
        renamingNodeID = nil
        focusedRenameNodeID = nil
        isSidebarListFocused = true

        guard !trimmed.isEmpty else { return }

        Task {
            switch targetID {
            case .collection(let id):
                await appState.renameCollection(id: id, name: trimmed)
            case .folder(let id):
                await appState.renameFolder(id: id, name: trimmed)
            case .request(let id):
                await appState.renameRequest(id: id, name: trimmed)
            case .sectionHeader:
                break
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
            case .createFolder(let cid, let pid):
                await appState.createFolder(name: name, collectionId: cid, parentId: pid)
            }
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
