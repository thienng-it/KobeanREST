import Foundation

public enum SidebarNodeID: Hashable, Sendable {
    case collection(String)
    case folder(String)
    case request(String)
    case sectionHeader(String)

    public var isCollapsible: Bool {
        switch self {
        case .collection, .folder:
            return true
        case .request, .sectionHeader:
            return false
        }
    }

    public var isRenameable: Bool {
        switch self {
        case .collection, .folder, .request:
            return true
        case .sectionHeader:
            return false
        }
    }
}

public enum SidebarTreeRowKind: Sendable, Equatable {
    case collection(CollectionSummary)
    case folder(FolderSummary, isOrphan: Bool)
    case request(SavedRequest)
    case sectionHeader(String)
}

public struct SidebarTreeRow: Identifiable, Sendable, Equatable {
    public let id: SidebarNodeID
    public let kind: SidebarTreeRowKind
    public let depth: Int
    public let isExpanded: Bool
    public let parentContainerID: SidebarNodeID?

    public var isCollapsible: Bool { id.isCollapsible }
    public var isRenameable: Bool { id.isRenameable }

    public var displayName: String {
        switch kind {
        case .collection(let col): return col.name
        case .folder(let folder, _): return folder.name
        case .request(let req): return req.name
        case .sectionHeader(let title): return title
        }
    }
}

public enum SidebarTreeBuilder {
    public static func allCollapsibleNodeIDs(workspace: WorkspaceSummary?) -> Set<SidebarNodeID> {
        guard let workspace else { return [] }
        var ids = Set((workspace.collections ?? []).map { SidebarNodeID.collection($0.id) })
        for folder in workspace.folders {
            ids.insert(.folder(folder.id))
        }
        return ids
    }

    public static func folderNodeIDs(inCollection collectionID: String, workspace: WorkspaceSummary?) -> Set<SidebarNodeID> {
        guard let workspace, !collectionID.isEmpty else { return [] }
        var folderIDs = Set(
            workspace.folders
                .filter { $0.collectionId == collectionID }
                .map(\.id)
        )
        var added = true
        while added {
            added = false
            for folder in workspace.folders where !folderIDs.contains(folder.id) {
                if let pid = folder.parentId, folderIDs.contains(pid) {
                    folderIDs.insert(folder.id)
                    added = true
                }
            }
        }
        return Set(folderIDs.map { .folder($0) })
    }

    public static func buildRows(
        workspace: WorkspaceSummary?,
        collapsedNodeIDs: Set<SidebarNodeID>,
        searchQuery: String
    ) -> [SidebarTreeRow] {
        guard let workspace else { return [] }

        let collections = workspace.collections ?? []
        let folders = workspace.folders
        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let isSearching = !query.isEmpty

        let filteredRequests: [SavedRequest] = isSearching
            ? workspace.requests.filter {
                $0.name.lowercased().contains(query)
                    || $0.url.lowercased().contains(query)
                    || $0.method.lowercased().contains(query)
            }
            : workspace.requests

        var foldersByCollection: [String: [FolderSummary]] = [:]
        var foldersByParent: [String: [FolderSummary]] = [:]
        for folder in folders {
            if let pid = folder.parentId, !pid.isEmpty {
                foldersByParent[pid, default: []].append(folder)
            } else if let cid = folder.collectionId, !cid.isEmpty {
                foldersByCollection[cid, default: []].append(folder)
            }
        }

        var requestsByContainer: [String: [SavedRequest]] = [:]
        for req in filteredRequests {
            requestsByContainer[req.folderId, default: []].append(req)
        }

        var rows: [SidebarTreeRow] = []

        func appendFolderBranch(
            _ folder: FolderSummary,
            depth: Int,
            parentID: SidebarNodeID?,
            isOrphan: Bool,
            visited: inout Set<String>
        ) -> [SidebarTreeRow] {
            guard visited.insert(folder.id).inserted else { return [] }

            let nodeID = SidebarNodeID.folder(folder.id)
            let isExpanded = isSearching || !collapsedNodeIDs.contains(nodeID)

            var childrenRows: [SidebarTreeRow] = []
            if isExpanded {
                for sub in foldersByParent[folder.id] ?? [] {
                    childrenRows.append(contentsOf: appendFolderBranch(
                        sub,
                        depth: depth + 1,
                        parentID: nodeID,
                        isOrphan: false,
                        visited: &visited
                    ))
                }
                for req in requestsByContainer[folder.id] ?? [] {
                    childrenRows.append(SidebarTreeRow(
                        id: .request(req.id),
                        kind: .request(req),
                        depth: depth + 1,
                        isExpanded: false,
                        parentContainerID: nodeID
                    ))
                }
            }

            if isSearching && childrenRows.isEmpty {
                return []
            }

            var branch: [SidebarTreeRow] = [
                SidebarTreeRow(
                    id: nodeID,
                    kind: .folder(folder, isOrphan: isOrphan),
                    depth: depth,
                    isExpanded: isExpanded,
                    parentContainerID: parentID
                )
            ]
            branch.append(contentsOf: childrenRows)
            return branch
        }

        var visitedFolders = Set<String>()

        for collection in collections {
            let nodeID = SidebarNodeID.collection(collection.id)
            let isExpanded = isSearching || !collapsedNodeIDs.contains(nodeID)

            var childrenRows: [SidebarTreeRow] = []
            if isExpanded {
                for rootFolder in foldersByCollection[collection.id] ?? [] {
                    childrenRows.append(contentsOf: appendFolderBranch(
                        rootFolder,
                        depth: 1,
                        parentID: nodeID,
                        isOrphan: false,
                        visited: &visitedFolders
                    ))
                }
                for req in requestsByContainer[collection.id] ?? [] {
                    childrenRows.append(SidebarTreeRow(
                        id: .request(req.id),
                        kind: .request(req),
                        depth: 1,
                        isExpanded: false,
                        parentContainerID: nodeID
                    ))
                }
            }

            if isSearching && childrenRows.isEmpty {
                continue
            }

            rows.append(SidebarTreeRow(
                id: nodeID,
                kind: .collection(collection),
                depth: 0,
                isExpanded: isExpanded,
                parentContainerID: nil
            ))
            rows.append(contentsOf: childrenRows)
        }

        let collectionIDs = Set(collections.map(\.id))
        let orphanFolders = folders.filter {
            ($0.parentId ?? "").isEmpty && !collectionIDs.contains($0.collectionId ?? "")
        }
        for folder in orphanFolders {
            rows.append(contentsOf: appendFolderBranch(
                folder,
                depth: 0,
                parentID: nil,
                isOrphan: true,
                visited: &visitedFolders
            ))
        }

        let knownContainerIDs = collectionIDs.union(folders.map(\.id))
        let unfiled = filteredRequests.filter { !knownContainerIDs.contains($0.folderId) }
        if !unfiled.isEmpty {
            let sectionID = SidebarNodeID.sectionHeader("unfiled-requests")
            rows.append(SidebarTreeRow(
                id: sectionID,
                kind: .sectionHeader("Requests"),
                depth: 0,
                isExpanded: true,
                parentContainerID: nil
            ))
            for req in unfiled {
                rows.append(SidebarTreeRow(
                    id: .request(req.id),
                    kind: .request(req),
                    depth: 1,
                    isExpanded: false,
                    parentContainerID: sectionID
                ))
            }
        }

        return rows
    }
}

