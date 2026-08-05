import { TabBar } from "../TabBar";
import type { Tab } from "../../types";

export function testTabBar() {
  const mockTabs: Tab[] = [
    { id: "tab-1", entityId: "req-1", type: "request", name: "New Request", method: "GET" },
  ];

  let newRequestCalled = false;

  // Render with tabs and onNewRequest
  const element = TabBar({
    tabs: mockTabs,
    activeTabId: "tab-1",
    onTabClick: () => {},
    onTabClose: () => {},
    onNewRequest: () => {
      newRequestCalled = true;
    },
  });

  if (!element || element.type !== "div") {
    throw new Error("Expected TabBar to return a div element");
  }

  // Verify new tab button is rendered and clickable
  const childrenArray = Array.isArray(element.props.children) ? element.props.children : [element.props.children];
  const newTabBtn = childrenArray.find((child: any) => child?.props?.["aria-label"] === "New tab");
  if (!newTabBtn) {
    throw new Error("Expected TabBar to render a button with aria-label='New tab'");
  }

  newTabBtn.props.onClick();
  if (!newRequestCalled) {
    throw new Error("Expected clicking '+' button to invoke onNewRequest callback");
  }

  // Render with empty tabs
  const emptyElement = TabBar({
    tabs: [],
    activeTabId: null,
    onTabClick: () => {},
    onTabClose: () => {},
    onNewRequest: () => {},
  });

  if (emptyElement !== null) {
    throw new Error("Expected TabBar to return null when tabs array is empty");
  }
}
