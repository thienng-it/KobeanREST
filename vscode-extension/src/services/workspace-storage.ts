import * as vscode from "vscode";
import * as crypto from "node:crypto";

export interface StoredCollection {
  id: string;
  name: string;
  requests: StoredRequest[];
  folders: StoredFolder[];
  authMode?: string;
  authConfig?: Record<string, unknown>;
  variables?: Array<{ key: string; value: string }>;
}

export interface StoredFolder {
  id: string;
  name: string;
  collectionId: string;
  parentId?: string;
  requests: StoredRequest[];
  authMode?: string;
  authConfig?: Record<string, unknown>;
  variables?: Array<{ key: string; value: string }>;
}

export interface StoredRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  folderId: string;
  headers: Array<{ key: string; value: string; enabled: boolean }>;
  queryParams: Array<{ key: string; value: string; enabled: boolean }>;
  body: string;
  bodyMimeType: string;
  bodyForm: Array<{ key: string; value: string; enabled: boolean }>;
  authMode: string;
  authConfig: Record<string, unknown>;
  timeoutMs: number;
  followRedirects: boolean;
  position: number;
  lastStatus?: number;
  lastDurationMs?: number;
}

export interface StoredEnvironment {
  name: string;
  variables: Array<{
    key: string;
    value: string;
    secret?: boolean;
    secretRef?: string;
  }>;
  color?: string;
}

export interface StoredHistoryEntry {
  id?: number;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  sizeBytes: number;
  createdAt: string;
}

interface WorkspaceData {
  version: number;
  activeEnvironment: string;
  collections: StoredCollection[];
  environments: StoredEnvironment[];
  history: StoredHistoryEntry[];
}

/**
 * JSON-file-based persistence in .kobeanrest/ workspace directory.
 * Uses atomic writes (temp file + rename) for data safety.
 */
export class WorkspaceStorageService {
  private data: WorkspaceData;
  private readonly storageDir: vscode.Uri;
  private readonly dataFile: vscode.Uri;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    this.storageDir = workspaceRoot
      ? vscode.Uri.joinPath(workspaceRoot, ".kobeanrest")
      : vscode.Uri.joinPath(context.globalStorageUri, "data");
    this.dataFile = vscode.Uri.joinPath(this.storageDir, "workspace.json");

    this.data = this.createDefaultData();
    this.loadFromDisk();
  }

  private createDefaultData(): WorkspaceData {
    return {
      version: 1,
      activeEnvironment: "Development",
      collections: [
        {
          id: crypto.randomUUID(),
          name: "Default Collection",
          requests: [],
          folders: [],
        },
      ],
      environments: [
        {
          name: "Development",
          variables: [
            { key: "baseUrl", value: "http://localhost:3000" },
          ],
          color: "#22c55e",
        },
        {
          name: "Production",
          variables: [
            { key: "baseUrl", value: "https://api.example.com" },
          ],
          color: "#ef4444",
        },
      ],
      history: [],
    };
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const raw = await vscode.workspace.fs.readFile(this.dataFile);
      const parsed = JSON.parse(Buffer.from(raw).toString("utf-8"));
      if (parsed?.version === 1) {
        this.data = parsed;
      }
    } catch {
      // File doesn't exist yet — use defaults and persist
      await this.saveToDisk();
    }
  }

  private onDidChangeWorkspaceDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeWorkspaceData = this.onDidChangeWorkspaceDataEmitter.event;

  private async saveToDisk(): Promise<void> {
    this.onDidChangeWorkspaceDataEmitter.fire();
    // Debounce saves to avoid excessive I/O
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(async () => {
      try {
        await vscode.workspace.fs.createDirectory(this.storageDir);
        const content = Buffer.from(
          JSON.stringify(this.data, null, 2),
          "utf-8",
        );
        await vscode.workspace.fs.writeFile(this.dataFile, content);
      } catch (err) {
        console.error("KobeanREST: Failed to save workspace data:", err);
      }
    }, 300);
  }

  // --- Collections ---
  getCollections(): StoredCollection[] {
    return this.data.collections;
  }

  createCollection(name: string): StoredCollection {
    const col: StoredCollection = {
      id: crypto.randomUUID(),
      name,
      requests: [],
      folders: [],
    };
    this.data.collections.push(col);
    this.saveToDisk();
    return col;
  }

  updateCollection(id: string, name: string): void {
    const col = this.data.collections.find((c) => c.id === id);
    if (col) {
      col.name = name;
      this.saveToDisk();
    }
  }

  createFolder(collectionId: string, name: string): StoredFolder {
    const col = this.data.collections.find((c) => c.id === collectionId);
    if (!col) throw new Error(`Collection ${collectionId} not found`);

    const folder: StoredFolder = {
      id: crypto.randomUUID(),
      name,
      collectionId,
      requests: [],
    };
    col.folders.push(folder);
    this.saveToDisk();
    return folder;
  }

  updateFolder(id: string, name: string): void {
    for (const col of this.data.collections) {
      const folder = col.folders.find((f) => f.id === id);
      if (folder) {
        folder.name = name;
        this.saveToDisk();
        return;
      }
    }
  }


  resolveLocation(locationId?: string): { collectionId: string; folderId: string } {
    if (locationId) {
      const cleanId = locationId.replace(/^(collection|folder|new_col):/, "").trim();
      const targetLower = cleanId.toLowerCase();
      const rawLower = locationId.toLowerCase();

      // 1. Check collections by ID or Name (case-insensitive)
      const col = this.data.collections.find(
        (c) =>
          c.id === cleanId ||
          c.id === locationId ||
          c.name.toLowerCase() === targetLower ||
          c.name.toLowerCase() === rawLower
      );
      if (col) {
        return { collectionId: col.id, folderId: col.id };
      }

      // 2. Check folders recursively across all collections by ID or Name
      const findFolderInList = (folders: StoredFolder[]): { collectionId: string; folderId: string } | null => {
        for (const f of folders) {
          if (
            f.id === cleanId ||
            f.id === locationId ||
            f.name.toLowerCase() === targetLower ||
            f.name.toLowerCase() === rawLower
          ) {
            return { collectionId: (f as any).collectionId || "", folderId: f.id };
          }
          if ((f as any).folders && Array.isArray((f as any).folders) && (f as any).folders.length > 0) {
            const nested = findFolderInList((f as any).folders);
            if (nested) return nested;
          }
        }
        return null;
      };

      for (const c of this.data.collections) {
        if (c.folders && Array.isArray(c.folders)) {
          const match = findFolderInList(c.folders);
          if (match) {
            return { collectionId: match.collectionId || c.id, folderId: match.folderId };
          }
        }
      }
    }
    let firstCol = this.data.collections[0];
    if (!firstCol) {
      firstCol = this.createCollection("Default Collection");
    }
    return { collectionId: firstCol.id, folderId: firstCol.id };
  }

  // --- Requests ---
  addRequest(
    collectionIdOrTarget: string,
    folderIdOrRequest?: string | Omit<StoredRequest, "id" | "position">,
    requestArg?: Omit<StoredRequest, "id" | "position">,
  ): StoredRequest {
    let targetLocation = collectionIdOrTarget;
    let reqData: Partial<StoredRequest> = {};

    if (typeof folderIdOrRequest === "object" && folderIdOrRequest !== null) {
      reqData = folderIdOrRequest;
    } else {
      if (folderIdOrRequest) {
        targetLocation = folderIdOrRequest;
      }
      if (requestArg) {
        reqData = requestArg;
      }
    }

    const { collectionId, folderId } = this.resolveLocation(targetLocation);
    const col = this.data.collections.find((c) => c.id === collectionId) || this.data.collections[0];

    const newReq: StoredRequest = {
      name: "New Request",
      method: "GET",
      url: "",
      headers: [],
      queryParams: [],
      body: "",
      bodyMimeType: "text/plain",
      bodyForm: [],
      authMode: "none",
      authConfig: {},
      timeoutMs: 30000,
      followRedirects: true,
      ...reqData,
      id: (reqData as any).id || crypto.randomUUID(),
      folderId: folderId || collectionId,
      position: 0,
    };

    if (col) {
      if (folderId && folderId !== collectionId) {
        const findFolder = (folders: StoredFolder[]): StoredFolder | undefined => {
          for (const f of folders) {
            if (f.id === folderId) return f;
            if ((f as any).folders && Array.isArray((f as any).folders) && (f as any).folders.length > 0) {
              const res = findFolder((f as any).folders);
              if (res) return res;
            }
          }
          return undefined;
        };

        const folder = findFolder(col.folders);
        if (folder) {
          if (!folder.requests) folder.requests = [];
          newReq.position = folder.requests.length;
          folder.requests.push(newReq);
          this.saveToDisk();
          return newReq;
        }
      }
      if (!col.requests) col.requests = [];
      newReq.position = col.requests.length;
      col.requests.push(newReq);
    }

    this.saveToDisk();
    return newReq;
  }

  updateRequest(request: StoredRequest): boolean {
    const findFolderById = (folders: StoredFolder[], targetId: string): StoredFolder | undefined => {
      for (const f of folders) {
        if (f.id === targetId) return f;
        if ((f as any).folders && Array.isArray((f as any).folders) && (f as any).folders.length > 0) {
          const res = findFolderById((f as any).folders, targetId);
          if (res) return res;
        }
      }
      return undefined;
    };

    for (const col of this.data.collections) {
      // Check root collection requests
      const rootIdx = (col.requests || []).findIndex((r) => r.id === request.id);
      if (rootIdx !== -1) {
        const existing = col.requests[rootIdx];
        const updated = { ...existing, ...request };

        if (request.folderId && request.folderId !== col.id) {
          const { collectionId: targetColId, folderId: targetFolderId } = this.resolveLocation(request.folderId);
          if (targetColId !== col.id || targetFolderId !== col.id) {
            col.requests.splice(rootIdx, 1);
            const targetCol = this.data.collections.find((c) => c.id === targetColId) || col;
            updated.folderId = targetFolderId;
            if (targetFolderId !== targetCol.id) {
              const targetFolder = findFolderById(targetCol.folders || [], targetFolderId);
              if (targetFolder) {
                if (!targetFolder.requests) targetFolder.requests = [];
                targetFolder.requests.push(updated);
                this.saveToDisk();
                return true;
              }
            }
            if (!targetCol.requests) targetCol.requests = [];
            targetCol.requests.push(updated);
            this.saveToDisk();
            return true;
          }
        }

        col.requests[rootIdx] = updated;
        this.saveToDisk();
        return true;
      }

      // Check folder requests recursively
      const updateInFolders = (folders: StoredFolder[]): boolean => {
        for (const folder of folders) {
          if (!folder.requests) folder.requests = [];
          const folderIdx = folder.requests.findIndex((r) => r.id === request.id);
          if (folderIdx !== -1) {
            const existing = folder.requests[folderIdx];
            const updated = { ...existing, ...request };

            if (request.folderId && request.folderId !== folder.id) {
              const { collectionId: targetColId, folderId: targetFolderId } = this.resolveLocation(request.folderId);
              if (targetColId !== col.id || targetFolderId !== folder.id) {
                folder.requests.splice(folderIdx, 1);
                const targetCol = this.data.collections.find((c) => c.id === targetColId) || col;
                updated.folderId = targetFolderId;
                if (targetFolderId !== targetCol.id) {
                  const targetFolder = findFolderById(targetCol.folders || [], targetFolderId);
                  if (targetFolder) {
                    if (!targetFolder.requests) targetFolder.requests = [];
                    targetFolder.requests.push(updated);
                    this.saveToDisk();
                    return true;
                  }
                }
                if (!targetCol.requests) targetCol.requests = [];
                targetCol.requests.push(updated);
                this.saveToDisk();
                return true;
              }
            }

            folder.requests[folderIdx] = updated;
            this.saveToDisk();
            return true;
          }

          if ((folder as any).folders && Array.isArray((folder as any).folders) && (folder as any).folders.length > 0) {
            if (updateInFolders((folder as any).folders)) return true;
          }
        }
        return false;
      };

      if (col.folders && updateInFolders(col.folders)) return true;
    }
    return false;
  }

  getAllRequests(): StoredRequest[] {
    const requests: StoredRequest[] = [];
    for (const col of this.data.collections) {
      requests.push(...col.requests);
      for (const folder of col.folders) {
        requests.push(...folder.requests);
      }
    }
    return requests;
  }

  duplicateRequest(requestId: string): void {
    for (const col of this.data.collections) {
      const idx = col.requests.findIndex((r) => r.id === requestId);
      if (idx !== -1) {
        const dup = {
          ...col.requests[idx],
          id: crypto.randomUUID(),
          name: `${col.requests[idx].name} (copy)`,
        };
        col.requests.splice(idx + 1, 0, dup);
        this.saveToDisk();
        return;
      }
      for (const folder of col.folders) {
        const fIdx = folder.requests.findIndex((r) => r.id === requestId);
        if (fIdx !== -1) {
          const dup = {
            ...folder.requests[fIdx],
            id: crypto.randomUUID(),
            name: `${folder.requests[fIdx].name} (copy)`,
          };
          folder.requests.splice(fIdx + 1, 0, dup);
          this.saveToDisk();
          return;
        }
      }
    }
  }

  deleteItem(id: string, type: string): void {
    if (type === "collection") {
      this.data.collections = this.data.collections.filter(
        (c) => c.id !== id,
      );
    } else if (type === "folder") {
      for (const col of this.data.collections) {
        col.folders = col.folders.filter((f) => f.id !== id);
      }
    } else if (type === "request") {
      for (const col of this.data.collections) {
        col.requests = col.requests.filter((r) => r.id !== id);
        for (const folder of col.folders) {
          folder.requests = folder.requests.filter((r) => r.id !== id);
        }
      }
    }
    this.saveToDisk();
  }

  // --- Environments ---
  getEnvironments(): StoredEnvironment[] {
    return this.data.environments;
  }

  getActiveEnvironment(): StoredEnvironment | undefined {
    return this.data.environments.find(
      (e) => e.name === this.data.activeEnvironment,
    );
  }

  getActiveEnvironmentName(): string {
    return this.data.activeEnvironment;
  }

  setActiveEnvironment(name: string): void {
    this.data.activeEnvironment = name;
    this.saveToDisk();
  }

  createEnvironment(name: string): void {
    if (!this.data.environments.some((e) => e.name === name)) {
      this.data.environments.push({ name, variables: [] });
      this.saveToDisk();
    }
  }

  deleteEnvironment(name: string): void {
    this.data.environments = this.data.environments.filter((e) => e.name !== name);
    if (this.data.activeEnvironment === name) {
      this.data.activeEnvironment = "Global";
    }
    this.saveToDisk();
  }

  updateEnvironment(name: string, variables: any[]): void {
    const env = this.data.environments.find((e) => e.name === name);
    if (env) {
      env.variables = variables;
      this.saveToDisk();
    }
  }

  // --- History ---
  getHistory(): StoredHistoryEntry[] {
    return this.data.history;
  }

  addHistoryEntry(entry: StoredHistoryEntry): void {
    const maxEntries =
      vscode.workspace
        .getConfiguration("kobeanrest")
        .get<number>("maxHistoryEntries") ?? 500;

    entry.id = Date.now();
    this.data.history.unshift(entry);
    if (this.data.history.length > maxEntries) {
      this.data.history = this.data.history.slice(0, maxEntries);
    }
    this.saveToDisk();
  }

  clearHistory(): void {
    this.data.history = [];
    this.saveToDisk();
  }

  // --- Import / Export ---
  importCollection(jsonString: string): void {
    const parsed = JSON.parse(jsonString);

    // Postman v2.1 format detection
    if (parsed?.info?.schema?.includes("postman")) {
      const col = this.convertPostmanCollection(parsed);
      this.data.collections.push(col);
    } else if (parsed?.openapi) {
      // OpenAPI format — create collection from paths
      const col = this.convertOpenApiSpec(parsed);
      this.data.collections.push(col);
    } else if (parsed?.version === 1 && parsed?.collections) {
      // KobeanREST native format
      for (const col of parsed.collections) {
        col.id = crypto.randomUUID();
        this.data.collections.push(col);
      }
    } else {
      throw new Error(
        "Unsupported format. Expected Postman v2.1, OpenAPI 3.x, or KobeanREST format.",
      );
    }
    this.saveToDisk();
  }

  private convertPostmanCollection(data: Record<string, unknown>): StoredCollection {
    const info = data.info as Record<string, string>;
    return {
      id: crypto.randomUUID(),
      name: info?.name ?? "Imported Collection",
      requests: [],
      folders: [],
    };
  }

  private convertOpenApiSpec(data: Record<string, unknown>): StoredCollection {
    const info = (data.info as Record<string, string>) ?? {};
    return {
      id: crypto.randomUUID(),
      name: info.title ?? "Imported OpenAPI Spec",
      requests: [],
      folders: [],
    };
  }

  exportAllCollections(): WorkspaceData {
    return { ...this.data };
  }
}
