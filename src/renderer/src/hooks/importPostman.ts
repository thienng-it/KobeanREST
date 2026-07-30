import { WorkspaceSummary, CollectionSummary, FolderSummary, SavedRequest, ScopedVariable } from "../types";
import {
  createCollection,
  createFolder,
  createRequest,
  saveRequest,
  saveScopedVariable,
  saveScript,
} from "../services/local-store";
import type {
  PostmanCollectionImportResult,
  PostmanEnvironmentImportResult,
} from "../services/postman-import";

/**
 * Import a Postman collection into the current workspace.
 * This function handles the complete import workflow:
 * - Creates a collection
 * - Creates folders in the correct hierarchy
 * - Creates requests
 * - Saves scoped variables at collection/folder/request level
 * - Saves pre/post scripts at all levels
 */
export async function importPostmanCollection(
  result: PostmanCollectionImportResult,
  workspace: WorkspaceSummary | null
): Promise<{
  collection: CollectionSummary;
  folders: FolderSummary[];
  requests: SavedRequest[];
}> {
  // Create the collection
  const collectionId = await createCollection(result.collectionName);

  const collection: CollectionSummary = {
    id: collectionId,
    name: result.collectionName,
    variables: result.collectionVariables,
  };

  // Save collection-level scoped variables
  for (const v of result.collectionVariables) {
    await saveScopedVariable(collectionId, "collection", v.key, v.value);
  }

  // Save collection-level scripts
  if (result.collectionPreScript) {
    await saveScript(collectionId, "collection", "pre", result.collectionPreScript);
  }
  if (result.collectionPostScript) {
    await saveScript(collectionId, "collection", "post", result.collectionPostScript);
  }

  // Build folder hierarchy
  // First, create a map from original folder ID to new folder object
  const folderIdMap: Record<string, FolderSummary> = {};
  const createdFolders: FolderSummary[] = [];

  // Helper function to recursively create folders with proper parent references
  async function createFoldersRecursive(
    folders: PostmanCollectionImportResult["folders"],
    parentId?: string
  ): Promise<void> {
    // Get all immediate children of this parent
    const immediateChildren = folders.filter((f) => f.parentId === parentId);

    for (const folder of immediateChildren) {
      // Create the folder in the collection
      const newFolder = await createFolder(folder.name, collectionId, folderIdMap[folder.parentId!]?.id ?? undefined);

      // Add to our tracking
      const folderWithVars: FolderSummary = {
        ...newFolder,
        collectionId,
        parentId: folder.parentId ? folderIdMap[folder.parentId]?.id : undefined,
        variables: folder.variables,
      };

      folderIdMap[folder.id] = folderWithVars;
      createdFolders.push(folderWithVars);

      // Save folder-level scoped variables
      for (const v of folder.variables) {
        await saveScopedVariable(newFolder.id, "folder", v.key, v.value);
      }

      // Save folder-level scripts
      if (folder.preScript) {
        await saveScript(newFolder.id, "folder", "pre", folder.preScript);
      }
      if (folder.postScript) {
        await saveScript(newFolder.id, "folder", "post", folder.postScript);
      }

      // Recursively create children
      await createFoldersRecursive(folders, folder.id);
    }
  }

  // Create all folders (top-level first, then nested)
  await createFoldersRecursive(result.folders);

  // Determine a default folder for requests without one
  let defaultFolder: FolderSummary | undefined;
  const hasRootRequests = result.requests.some((r) => !r.folderId);

  if (hasRootRequests) {
    // Create a default folder for requests that aren't in any folder
    defaultFolder = await createFolder("Requests", collectionId, undefined);
    const folderWithVars: FolderSummary = {
      ...defaultFolder,
      collectionId,
      parentId: undefined,
      variables: [],
    };
    createdFolders.push(folderWithVars);
  }

  // Create all requests
  const createdRequests: SavedRequest[] = [];

  for (const req of result.requests) {
    // Determine the target folder
    const targetFolderId = req.folderId
      ? folderIdMap[req.folderId]?.id
      : defaultFolder?.id;

    if (!targetFolderId) continue; // This shouldn't happen with the default folder

    // Create the request
    const newReq = await createRequest(targetFolderId);

    // Build the full request object
    const savedReq: SavedRequest = {
      ...newReq,
      name: req.name,
      method: req.method as SavedRequest["method"],
      customMethod: req.method === "CUSTOM" ? req.method : undefined,
      url: req.url,
      headers: req.headers,
      queryParams: req.queryParams,
      body: req.body,
      bodyMimeType: req.bodyMimeType,
      bodyForm: req.bodyForm,
      authMode: req.authMode,
      authConfig: req.authConfig,
      variables: req.variables,
      folderId: targetFolderId,
    };

    // Save the request
    await saveRequest(savedReq);
    createdRequests.push(savedReq);

    // Save request-level scoped variables
    for (const v of req.variables) {
      await saveScopedVariable(newReq.id, "request", v.key, v.value);
    }

    // Save request-level scripts
    if (req.preScript) {
      await saveScript(newReq.id, "request", "pre", req.preScript);
    }
    if (req.postScript) {
      await saveScript(newReq.id, "request", "post", req.postScript);
    }
  }

  return {
    collection,
    folders: createdFolders,
    requests: createdRequests,
  };
}

/**
 * Import a Postman environment as a new environment in the current workspace.
 */
export async function importPostmanEnvironment(
  result: PostmanEnvironmentImportResult,
  saveVariableFn: (envName: string, key: string, value: string) => Promise<void>,
  createEnvironmentFn: (name: string) => Promise<any>
): Promise<{ name: string; variablesCount: number }> {
  // Create the environment
  await createEnvironmentFn(result.name);

  // Save each variable
  for (const v of result.variables) {
    // For secrets, we just save as regular variables for now
    // In the future, could use saveSecretVariable if available
    await saveVariableFn(result.name, v.key, v.value);
  }

  return {
    name: result.name,
    variablesCount: result.variables.length,
  };
}
