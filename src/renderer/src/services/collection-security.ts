import type { CollectionLockConfig, CollectionSummary, WorkspaceSummary } from '../types';

const STORAGE_KEY = 'kb_collection_locks';

/**
 * Computes a SHA-256 hash of salt + password using the Web Crypto API.
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${password.trim()}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a random cryptographic salt.
 */
export function generateSalt(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Verifies if a plain password matches the stored salted hash.
 */
export async function verifyPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  const computed = await hashPassword(password, salt);
  return computed.toLowerCase() === expectedHash.toLowerCase();
}

/**
 * Retrieves all stored collection lock configs from localStorage.
 */
export function getStoredCollectionLocks(): Record<string, CollectionLockConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Saves all collection lock configs to localStorage.
 */
export function saveStoredCollectionLocks(locks: Record<string, CollectionLockConfig>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(locks));
  } catch (err) {
    console.error('Failed to save collection locks to localStorage:', err);
  }
}

/**
 * Gets the lock configuration for a given collection ID.
 */
export function getCollectionLockConfig(collectionId: string): CollectionLockConfig | null {
  const locks = getStoredCollectionLocks();
  return locks[collectionId] || null;
}

/**
 * Sets or updates lock protection on a collection.
 */
export async function setCollectionLock(
  collectionId: string,
  password: string,
  hint?: string
): Promise<CollectionLockConfig> {
  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);

  const lockConfig: CollectionLockConfig = {
    isLocked: true,
    passwordHash,
    salt,
    hint: hint?.trim() || undefined,
    lockedAt: Date.now(),
  };

  const locks = getStoredCollectionLocks();
  locks[collectionId] = lockConfig;
  saveStoredCollectionLocks(locks);

  return lockConfig;
}

/**
 * Unlocks a collection for the current session if the password is valid.
 */
export async function unlockCollectionInSession(
  collectionId: string,
  password: string,
  unlockedSet: Set<string>
): Promise<{ success: boolean; error?: string }> {
  const lockConfig = getCollectionLockConfig(collectionId);
  if (!lockConfig || !lockConfig.passwordHash || !lockConfig.salt) {
    // If not protected, mark as unlocked
    unlockedSet.add(collectionId);
    return { success: true };
  }

  const isValid = await verifyPassword(password, lockConfig.salt, lockConfig.passwordHash);
  if (!isValid) {
    return { success: false, error: 'Incorrect PIN or password.' };
  }

  unlockedSet.add(collectionId);
  return { success: true };
}

/**
 * Re-locks a collection in the current session.
 */
export function relockCollectionInSession(collectionId: string, unlockedSet: Set<string>): void {
  unlockedSet.delete(collectionId);
}

/**
 * Removes password protection from a collection.
 */
export async function removeCollectionLock(
  collectionId: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const lockConfig = getCollectionLockConfig(collectionId);
  if (!lockConfig || !lockConfig.passwordHash || !lockConfig.salt) {
    const locks = getStoredCollectionLocks();
    delete locks[collectionId];
    saveStoredCollectionLocks(locks);
    return { success: true };
  }

  const isValid = await verifyPassword(password, lockConfig.salt, lockConfig.passwordHash);
  if (!isValid) {
    return { success: false, error: 'Incorrect current PIN or password.' };
  }

  const locks = getStoredCollectionLocks();
  delete locks[collectionId];
  saveStoredCollectionLocks(locks);

  return { success: true };
}

/**
 * Checks if a collection is currently locked in the active session.
 */
export function isCollectionLocked(
  collection: { id: string; lockConfig?: CollectionLockConfig | null } | null | undefined,
  unlockedSet: Set<string>
): boolean {
  if (!collection) return false;
  const config = collection.lockConfig || getCollectionLockConfig(collection.id);
  if (!config || !config.isLocked || !config.passwordHash) {
    return false;
  }
  return !unlockedSet.has(collection.id);
}

/**
 * Determines the ancestor collection ID for a request, folder, or collection.
 */
export function findParentCollectionId(
  targetId: string,
  workspace: WorkspaceSummary | null | undefined
): string | null {
  if (!workspace || !targetId) return null;

  // 1. Direct collection match
  if (workspace.collections?.some((c) => c.id === targetId)) {
    return targetId;
  }

  // 2. Direct folder match
  const folder = workspace.folders?.find((f) => f.id === targetId);
  if (folder) {
    if (folder.collectionId) return folder.collectionId;
    if (folder.parentId) return findParentCollectionId(folder.parentId, workspace);
  }

  // 3. Request match
  const req = workspace.requests?.find((r) => r.id === targetId);
  if (req) {
    if (req.folderId) return findParentCollectionId(req.folderId, workspace);
  }

  return null;
}

/**
 * Checks whether an item (collection, folder, or request) is inside a locked collection.
 */
export function isItemInLockedCollection(
  itemId: string,
  workspace: WorkspaceSummary | null | undefined,
  unlockedSet: Set<string>
): boolean {
  if (!workspace || !itemId) return false;
  const parentColId = findParentCollectionId(itemId, workspace);
  if (!parentColId) return false;

  const col = workspace.collections?.find((c) => c.id === parentColId);
  return isCollectionLocked(col || { id: parentColId }, unlockedSet);
}
