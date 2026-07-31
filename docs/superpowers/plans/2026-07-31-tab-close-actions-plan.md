# Tab Close Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Close All, Close Current, Close Others tab actions via right-click context menu.

**Architecture:** Extend existing TabBar to emit context menu events, extend ContextMenu to handle tab targets, implement logic in App.tsx.

**Tech Stack:** React, TypeScript, lucide-react icons

## Global Constraints

- Follow existing component patterns
- Use danger confirmVariant for unsaved changes confirmations
- Use isDirty flag on Tab interface for unsaved changes

---

### Task 1: Extend TabBar for Context Menu

**Files:**
- Modify: `src/renderer/src/components/TabBar.tsx`

**Interfaces:**
- Consumes: Existing Tab interface (id, type, entityId, name, isDirty?)
- Produces: TabBar now accepts `onTabContextMenu(tabId: string, x: number, y: number)

**Steps:**

- [ ] Add `onTabContextMenu` prop to TabBarProps
- [ ] Add `onContextMenu` handler on each tab button
- [ ] Call `preventDefault() to preventDefault()
- [ ] Call onTabContextMenu(tab.id, e.clientX, e.clientY
- [ ] Commit

### Task 2: Extend ContextMenu types and handlers

**Files:**
- Modify: `src/renderer/src/components/ContextMenu.tsx`
- Modify: `src/renderer/src/components/ContextMenu.tsx:4-14` (ContextMenuTarget/ContextMenuState

**Interfaces:**
- Consumes: ContextMenuTarget: ContextMenuTarget now:
  - Extend ContextMenuTarget.type to include "tab"
  - Add handlers: onCloseTab, onCloseOtherTabs, onCloseAllTabs
- Produces: ContextMenuProps now has "tab" target case

**Steps:**

- [ ] Add "tab" to ContextMenuTarget.type:
  ```typescript
  type: "folder" | "request" | "collection" | "workspace" | "selection" | "tab";
  ```
- [ ] Add handlers to ContextMenuProps:
  ```typescript
  onCloseTab?: (tabId: string) => void;
  onCloseOtherTabs?: (tabId: string) => void;
  onCloseAllTabs?: () => void;
  ```
- [ ] Add "tab" case in render logic:
  - Close Current Tab
  - Close Other Tabs (disabled when tabs count <= 1, but wait—context menu doesn't know tab count. Hmm, actually the caller (App.tsx) will decide what to enable/disable, but in App.tsx via disabled? Wait no—the ContextMenu just renders the items; App decides to show/hide. Actually better: let's simplify: show all three items always. "Close Others" is always available, but when calling handler will just does nothing if only 1 tab.
  - Actually, let's just show all three items. The handler will implement logic in App.tsx.

- [ ] Add menu items for "tab" target:
  - Close Current Tab
  - Close Other Tabs
  - Close All Tabs

- [ ] Commit

### Task 3: Implement handlers in App.tsx

**Files:**
- Modify: `src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: tabs state, activeTabId state, closeTab function, performCloseTab function, setConfirmDialog
- Produces:
  - handleCloseTabContextMenu(tabId: string)
  - handleCloseOtherTabs(excludeTabId: string)
  - handleCloseAllTabs()

**Steps:**

- [ ] Add state for tab context menu? Or reuse existing contextMenu state? Wait existing contextMenu state is ContextMenuState which has { x, y, target. Yes extend target can be type "tab".
- [ ] Add onTabContextMenu handler in TabBar:
  ```typescript
  onTabContextMenu={(tabId, x, y) => {
    setContextMenu({ x, y, target: { id: tabId, type: "tab" });
  }
  ```

- [ ] Implement handleCloseTab(tabId): call closeTab(tabId) — existing function already exists.

- [ ] Implement handleCloseOtherTabs(excludeTabId):
  ```typescript
  function handleCloseOtherTabs(excludeTabId: string) {
    const tabsToClose = tabs.filter(t => t.id !== excludeTabId);
    const dirtyCount = tabsToClose.filter(t => t.isDirty).length;
    
    if (dirtyCount > 0) {
      setConfirmDialog({
        message: `You have unsaved changes in ${dirtyCount} tab(s). Are you sure you want to discard them?`,
        confirmVariant: "danger",
        onConfirm: () => {
          const remaining = tabs.filter(t => t.id === excludeTabId);
          setTabs(remaining);
          if (!remaining.find(t => t.id === activeTabId)) {
            // switch? activeTabId = remaining.length > 0 ? remaining[0].id : null;
          }
        }
      });
    } else {
      // Close directly
      setTabs(tabs.filter(t => t.id === excludeTabId));
      // activeTab check...
    }
  }
  ```

- [ ] Implement handleCloseAllTabs():
  ```typescript
  function handleCloseAllTabs() {
    const dirtyCount = tabs.filter(t => t.isDirty).length;
    
    if (dirtyCount > 0) {
      setConfirmDialog({
        message: `You have unsaved changes in ${dirtyCount} tab(s). Are you sure you want to discard them?`,
        confirmVariant: "danger",
        onConfirm: () => {
          setTabs([]);
          setActiveTabId(null);
        }
      });
    } else {
      setTabs([]);
      setActiveTabId(null);
    }
  }
  ```

- [ ] Pass handlers to ContextMenu component:
  onCloseTab, onCloseOtherTabs, onCloseAllTabs

- [ ] Commit

### Task 4: Test manually

- [ ] Open app and verify:
  - Right-click a tab → menu appears
  - Close Current works (works with existing dirty check)
  - Close Others (dirty tabs → single confirm)
  - Close All (dirty tabs → single confirm)
  - After close others with dirty → activeTab switches correctly
