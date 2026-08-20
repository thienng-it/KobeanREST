import React from "react";
import { ChevronDown, ExternalLink, Eye, Terminal } from "lucide-react";
import { ResponsePanel, type ResponseTab } from "./ResponsePanel";
import { ConsolePanel } from "./ConsolePanel";
import { type PreviewMode } from "../response-utils";
import type { ExecuteHttpResponse } from "../types";
import type { ResponseState } from "../response-utils";
import type { ScriptOutputEntry } from "../hooks/useScripts";

export interface BottomDockProps {
  activeBottomDock: "response" | "console" | null;
  bottomDockHeight: number;
  bottomDockStripHeight: number;
  responseState: ResponseState;
  currentResponse: ExecuteHttpResponse | undefined;
  responseTitle: string;
  responseTitleColor: string;
  isResponseTabPending: boolean;
  responseTab: ResponseTab;
  previewMode: PreviewMode;
  scriptOutputLog: ScriptOutputEntry[];
  isRequestTabsCollapsed?: boolean;
  autoWrap?: boolean;
  autoCollapse?: boolean;
  onActiveBottomDockChange: (dock: "response" | "console" | null) => void;
  onTabChange: (tab: ResponseTab) => void;
  onPreviewModeChange: (mode: PreviewMode) => void;
  onDownload: () => void;
  onCopy: () => void;
  onOpenHistory: () => void;
  onOpenWindow: () => void;
  onResizerMouseDown: () => void;
  onClearConsole?: () => void;
}

export const BottomDock = React.memo(function BottomDock({
  activeBottomDock,
  bottomDockHeight,
  bottomDockStripHeight,
  responseState,
  currentResponse,
  responseTitle,
  responseTitleColor,
  isResponseTabPending,
  responseTab,
  previewMode,
  scriptOutputLog,
  isRequestTabsCollapsed,
  autoWrap = true,
  autoCollapse = false,
  onActiveBottomDockChange,
  onTabChange,
  onPreviewModeChange,
  onDownload,
  onCopy,
  onOpenHistory,
  onOpenWindow,
  onResizerMouseDown,
  onClearConsole,
}: BottomDockProps) {
  const open = activeBottomDock !== null;
  const hasResponse = !(responseState.kind === "idle" && !currentResponse);
  const hasConsoleErrors = scriptOutputLog.some(
    (e) => e.tone === "error" || e.type === "test_fail",
  );

  const dockStyle: React.CSSProperties = open
    ? isRequestTabsCollapsed
      ? { flex: 1, minHeight: "260px", height: "100%" }
      : { height: `${bottomDockHeight + bottomDockStripHeight}px` }
    : { height: `${bottomDockStripHeight}px` };

  // If no response and no console logs and dock closed, still keep strip accessible
  return (
    <section
      className={`bottom-dock ${isRequestTabsCollapsed ? "expanded-view" : ""}`}
      aria-label="Bottom dock"
      style={dockStyle}
    >
      {open && (
        <div
          className="bottom-dock-resizer"
          role="separator"
          aria-label="Resize bottom panel"
          onMouseDown={onResizerMouseDown}
          title="Drag to resize panel height"
        />
      )}
      <div className="bottom-dock-strip">
        <div className="bottom-dock-tabs">
          <button
            className={activeBottomDock === "response" ? "bottom-dock-tab active" : "bottom-dock-tab"}
            type="button"
            onClick={() => onActiveBottomDockChange(activeBottomDock === "response" ? null : "response")}
          >
            <Eye size={14} /> Response
          </button>
          <button
            className={activeBottomDock === "console" ? "bottom-dock-tab active" : "bottom-dock-tab"}
            type="button"
            onClick={() => onActiveBottomDockChange(activeBottomDock === "console" ? null : "console")}
          >
            <Terminal size={14} /> Console
            <span className={`bottom-dock-badge ${hasConsoleErrors ? "has-errors" : ""}`}>
              {scriptOutputLog.length}
            </span>
          </button>
        </div>

        <div className="bottom-dock-toolbar-right">
          {activeBottomDock === "response" && (
            <button
              className="bottom-dock-open-window-btn"
              type="button"
              aria-label="Open response in new window"
              title="Open in new window"
              onClick={(e) => {
                e.stopPropagation();
                onOpenWindow();
              }}
            >
              <ExternalLink size={12} />
              <span>Open in Window</span>
            </button>
          )}
          <button
            className={open ? "bottom-dock-collapse expanded" : "bottom-dock-collapse collapsed"}
            type="button"
            aria-label={open ? "Collapse bottom dock" : "Expand bottom dock"}
            onClick={() =>
              onActiveBottomDockChange(open ? null : "response")
            }
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </div>
      <div className="bottom-dock-panels">
        {activeBottomDock === "response" && (
          <ResponsePanel
            variant="dock"
            responseState={responseState}
            currentResponse={currentResponse}
            responseTitle={responseTitle}
            responseTitleColor={responseTitleColor}
            isResponseTabPending={isResponseTabPending}
            responseTab={responseTab}
            previewMode={previewMode}
            activeBottomDock={activeBottomDock}
            scriptOutputLog={scriptOutputLog}
            autoWrap={autoWrap}
            autoCollapse={autoCollapse}
            onTabChange={onTabChange}
            onPreviewModeChange={onPreviewModeChange}
            onDownload={onDownload}
            onCopy={onCopy}
            onOpenHistory={onOpenHistory}
            onOpenWindow={onOpenWindow}
            onResizerMouseDown={onResizerMouseDown}
          />
        )}
        {activeBottomDock === "console" && (
          <ConsolePanel
            scriptOutputLog={scriptOutputLog}
            onClearConsole={onClearConsole}
          />
        )}
      </div>
    </section>
  );
});
