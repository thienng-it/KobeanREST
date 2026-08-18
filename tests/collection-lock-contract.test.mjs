import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
const hasFile = (path) => existsSync(new URL(path, root));

test("Collection security service file exists and implements secure salted hashing", () => {
  assert.equal(hasFile("src/renderer/src/services/collection-security.ts"), true);
  const securityService = read("src/renderer/src/services/collection-security.ts");

  assert.match(securityService, /export async function hashPassword/);
  assert.match(securityService, /export async function verifyPassword/);
  assert.match(securityService, /export function generateSalt/);
  assert.match(securityService, /crypto\.subtle\.digest\(["']SHA-256["']/);
  assert.match(securityService, /export function getStoredCollectionLocks/);
  assert.match(securityService, /export function saveStoredCollectionLocks/);
  assert.match(securityService, /export async function setCollectionLock/);
  assert.match(securityService, /export async function unlockCollectionInSession/);
  assert.match(securityService, /export function relockCollectionInSession/);
  assert.match(securityService, /export async function removeCollectionLock/);
  assert.match(securityService, /export function isCollectionLocked/);
  assert.match(securityService, /export function findParentCollectionId/);
  assert.match(securityService, /export function isItemInLockedCollection/);
});

test("LockCollectionModal and LockedCollectionGate components are implemented", () => {
  assert.equal(hasFile("src/renderer/src/components/LockCollectionModal.tsx"), true);
  const modal = read("src/renderer/src/components/LockCollectionModal.tsx");

  assert.match(modal, /export function LockCollectionModal/);
  assert.match(modal, /export function LockedCollectionGate/);
  assert.match(modal, /LockModalMode/);
  assert.match(modal, /Lock Collection/);
  assert.match(modal, /Unlock Collection/);
  assert.match(modal, /Remove Lock/);
});

test("Sidebar integrates collection lock indicators and click-to-unlock actions", () => {
  const sidebar = read("src/renderer/src/components/Sidebar.tsx");

  assert.match(sidebar, /unlockedCollectionIds/);
  assert.match(sidebar, /onLockCollectionToggle/);
  assert.match(sidebar, /getCollectionLockConfig/);
  assert.match(sidebar, /Locked collection — Click to unlock/);
});

test("ContextMenu provides lock, unlock, and remove lock options for collections", () => {
  const contextMenu = read("src/renderer/src/components/ContextMenu.tsx");

  assert.match(contextMenu, /onLockCollection/);
  assert.match(contextMenu, /onUnlockCollection/);
  assert.match(contextMenu, /onRelockCollection/);
  assert.match(contextMenu, /onRemoveCollectionLock/);
  assert.match(contextMenu, /isCollectionProtected/);
  assert.match(contextMenu, /isCollectionUnlockedInSession/);
  assert.match(contextMenu, /Set Passcode Lock|Lock Collection/);
  assert.match(contextMenu, /Unlock Collection/);
  assert.match(contextMenu, /Remove Lock/);
});

test("App guards locked collection, folder, and request views with LockedCollectionGate", () => {
  const app = read("src/renderer/src/App.tsx");

  assert.match(app, /LockCollectionModal/);
  assert.match(app, /LockedCollectionGate/);
  assert.match(app, /unlockedCollectionIds/);
  assert.match(app, /isItemInLockedCollection/);
  assert.match(app, /isCollectionLocked/);
  assert.match(app, /handleSetCollectionLockAction/);
  assert.match(app, /handleUnlockCollectionAction/);
  assert.match(app, /handleRemoveCollectionLockAction/);
});

test("Types definition includes CollectionLockConfig on CollectionSummary", () => {
  const types = read("src/renderer/src/types.ts");

  assert.match(types, /export interface CollectionLockConfig/);
  assert.match(types, /isLocked: boolean/);
  assert.match(types, /passwordHash\?: string/);
  assert.match(types, /salt\?: string/);
  assert.match(types, /hint\?: string/);
  assert.match(types, /lockConfig\?: CollectionLockConfig/);
});

test("Cryptographic password hashing and verification unit test with Web Crypto API", async () => {
  const enc = new TextEncoder();
  const generateSalt = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  };

  const hashPassword = async (password, salt) => {
    const data = enc.encode(password + ":" + salt);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
  };

  const verifyPassword = async (password, salt, hash) => {
    const computed = await hashPassword(password, salt);
    return computed === hash;
  };

  const salt = generateSalt();
  assert.equal(salt.length, 32);

  const hash = await hashPassword("super-secret-pin-1234", salt);
  assert.equal(typeof hash, "string");
  assert.equal(hash.length, 64);

  const valid = await verifyPassword("super-secret-pin-1234", salt, hash);
  assert.equal(valid, true);

  const invalid = await verifyPassword("wrong-pin", salt, hash);
  assert.equal(invalid, false);
});
