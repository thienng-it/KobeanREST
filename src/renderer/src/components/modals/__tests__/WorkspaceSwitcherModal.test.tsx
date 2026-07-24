import type { WorkspaceListItem } from "../../../types";
import { WorkspaceSwitcherModal } from "../WorkspaceSwitcherModal";

export function testWorkspaceSwitcherModal() {
  const mockWorkspaces: WorkspaceListItem[] = [
    { id: "ws-1", name: "Default Workspace" },
    { id: "ws-2", name: "Secondary Workspace" },
  ];

  // Test closed state
  const closedElement = WorkspaceSwitcherModal({
    isOpen: false,
    activeWorkspaceId: "ws-1",
    workspaceList: mockWorkspaces,
    onCreate: () => {},
    onSwitch: () => {},
    onRename: () => {},
    onDelete: () => {},
    onClose: () => {},
  });
  if (closedElement !== null) {
    throw new Error("Expected modal to return null when closed");
  }

  // Test open state
  const openElement = WorkspaceSwitcherModal({
    isOpen: true,
    activeWorkspaceId: "ws-1",
    workspaceList: mockWorkspaces,
    onCreate: () => {},
    onSwitch: () => {},
    onRename: () => {},
    onDelete: () => {},
    onClose: () => {},
  });
  if (!openElement || openElement.type !== "div") {
    throw new Error("Expected modal to return a div element when open");
  }
}
