import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sidebarPath = path.resolve(__dirname, "../src/renderer/src/components/AIChatSidebar.tsx");
const storePath = path.resolve(__dirname, "../src/renderer/src/services/ai-chat-store.ts");

test("ai-chat-store and AIChatSidebar export ChatSession interface and session management helpers", () => {
  const sidebarContent = fs.readFileSync(sidebarPath, "utf-8");
  const storeContent = fs.readFileSync(storePath, "utf-8");

  // Verify ChatSession interface structure in store
  assert.match(storeContent, /export\s+interface\s+ChatSession\s*\{/);
  assert.match(storeContent, /id:\s*string/);
  assert.match(storeContent, /title:\s*string/);
  assert.match(storeContent, /messages:\s*Message\[\]/);

  // Verify session persistence keys & functions in store
  assert.match(storeContent, /kobeanrest_ai_chat_sessions/);
  assert.match(storeContent, /export\s+function\s+loadChatSessions/);
  assert.match(storeContent, /export\s+function\s+saveChatSessions/);

  // Verify session manager UI components & actions in sidebar
  assert.match(sidebarContent, /createNewSession/);
  assert.match(sidebarContent, /switchSession/);
  assert.match(sidebarContent, /deleteSession/);
  assert.match(sidebarContent, /showSessionsDrawer/);
  assert.match(sidebarContent, /sidebarWidth/);
  assert.match(sidebarContent, /kobeanrest_ai_chat_width/);
  assert.match(sidebarContent, /handleMouseDownResizer/);
});
