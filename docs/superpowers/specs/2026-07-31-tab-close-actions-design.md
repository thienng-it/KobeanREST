# Tab Close Actions Design

## Date
2026-07-31

## Feature
Add Close All, Close Current, and Close Others tab actions via right-click context menu.

## Requirements
1. Right-click context menu on tabs with:
   - Close Current Tab
   - Close Other Tabs
   - Close All Tabs
2. Handle unsaved changes (dirty tabs) with single summary confirmation
3. Confirm button uses danger (red) variant
4. Disable "Close Others" when only 1 tab

## Implementation Plan

### 1. Types & Interfaces
- Extend `ContextMenuTarget` to include `"tab"` type
- Extend `ContextMenuState.target` to support tab ID

### 2. Component Changes

#### TabBar.tsx
- Add `onContextMenu` prop to TabBar
- On tab right-click, call callback with `{ tabId, x, y }`

#### ContextMenu.tsx
- Add "tab" case to target type switch
- Add menu items with callbacks:
  - `onCloseTab(tabId: string)`
  - `onCloseOtherTabs(tabId: string)`
  - `onCloseAllTabs()`

#### App.tsx
- Implement handlers:
  - `handleCloseTab(tabId)` → uses existing closeTab (single dirty check)
  - `handleCloseOtherTabs(excludeTabId)` → collect tabs to close, count dirty, show confirm
  - `handleCloseAllTabs()` → collect all tabs, count dirty, show confirm

### 3. Dirty Tab Handling Logic
For multi-tab close operations:
```typescript
const tabsToClose = tabs.filter(t => t.id !== excludeTabId);
const dirtyCount = tabsToClose.filter(t => t.isDirty).length;

if (dirtyCount > 0) {
  setConfirmDialog({
    message: `You have unsaved changes in ${dirtyCount} tab(s). Are you sure you want to discard them?`,
    confirmVariant: "danger",
    onConfirm: () => {
      // Actually close tabs
      setTabs(tabs.filter(t => t.id === excludeTabId));
      // If excludeTabId is null (close all), set to []
      // Also adjust activeTabId if needed
    }
  });
} else {
  // No dirty tabs, close directly
}
```

### 4. Edge Cases
- "Close Others" disabled when tabs.length <= 1
- After closing, set activeTabId to a remaining tab (or null if none)
- If active tab is being closed, switch to last remaining tab

## Files to Modify
- `src/renderer/src/components/TabBar.tsx`
- `src/renderer/src/components/ContextMenu.tsx`
- `src/renderer/src/App.tsx`

## Dependencies
- Existing confirm dialog system (setConfirmDialog with confirmVariant)
- Existing tab closing logic (closeTab, performCloseTab)
