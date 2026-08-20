import React from "react";
import { ChevronDown, ExternalLink, Eye, Terminal } from "lucide-react";
import { ResponsePanel, type ResponseTab } from "./ResponsePanel";
import { ConsolePanel } from "./ConsolePanel";
import { type PreviewMode } from "../response-utils";
import type { ExecuteHttpResponse } from "../types";
import type { ResponseState } from "../response-utils";
import type { ScriptOutputEntry } from "../hooks/useScripts";
import { useI18n } from "../services/i18n";

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
  layoutMode?: "stacked" | "split";
  splitResponseWidth?: number;
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
  layoutMode = "stacked",
  splitResponseWidth = 480,
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
  const { t } = useI18n();
  const open = activeBottomDock !== null;
  const isSplit = layoutMode === "split";
  const hasResponse = !(responseState.kind === "idle" && !currentResponse);
  const hasConsoleErrors = scriptOutputLog.some(
    (e) => e.tone === "error" || e.type === "test_fail",
  );

  const dockStyle: React.CSSProperties = isSplit
    ? open
      ? {
          width: `${splitResponseWidth}px`,
          minWidth: "280px",
          maxWidth: "80%",
          flex: `0 0 ${splitResponseWidth}px`,
          height: "100%",
          minHeight: "100%",
        }
      : {
          width: "40px",
          minWidth: "40px",
          flex: "0 0 40px",
          height: "100%",
          minHeight: "100%",
        }
    : open
    ? isRequestTabsCollapsed
      ? { flex: 1, minHeight: "260px", height: "100%" }
      : { height: `${bottomDockHeight + bottomDockStripHeight}px` }
    : { height: `${bottomDockStripHeight}px` };

  // If no response and no console logs and dock closed, still keep strip accessible
  return (
    <section
      className={`bottom-dock ${isRequestTabsCollapsed ? "expanded-view" : ""} ${isSplit ? "split-mode" : ""} ${open ? "has-open-dock" : "dock-collapsed"}`}
      aria-label={isSplit ? t("dock.responseSidebar") : t("dock.bottomDock")}
      style={dockStyle}
      onClick={!open && isSplit ? () => onActiveBottomDockChange("response") : undefined}
    >
      {open && (
        <div
          className="bottom-dock-resizer"
          role="separator"
          aria-label={isSplit ? "Resize split panel width" : "Resize bottom panel height"}
          onMouseDown={onResizerMouseDown}
          title={isSplit ? "Drag to resize panel width" : "Drag to resize panel height"}
        />
      )}
      <div className="bottom-dock-strip">
        <div className="bottom-dock-tabs">
          <button
            className={activeBottomDock === "response" ? "bottom-dock-tab active" : "bottom-dock-tab"}
            type="button"
            onClick={() => onActiveBottomDockChange(activeBottomDock === "response" ? null : "response")}
          >
            <Eye size={14} /> {t("dock.response")}
          </button>
        </div>

        <div className="bottom-dock-toolbar-right">
          {activeBottomDock === "response" && (
            <button
              className="bottom-dock-open-window-btn"
              type="button"
              aria-label={t("dock.openInWindow")}
              title={t("dock.openInWindow")}
              onClick={(e) => {
                e.stopPropagation();
                onOpenWindow();
              }}
            >
              <ExternalLink size={12} />
              <span>{t("dock.openInWindow")}</span>
            </button>
          )}
          <button
            className={`bottom-dock-collapse ${open ? "expanded" : "collapsed"}`}
            type="button"
            aria-label={
              isSplit
                ? open
                  ? "Hide response panel (collapse horizontally)"
                  : "Show response panel (expand horizontally)"
                : open
                ? "Collapse bottom dock"
                : "Expand bottom dock"
            }
            title={
              isSplit
                ? open
                  ? "Hide response panel"
                  : "Show response panel"
                : open
                ? "Collapse response dock"
                : "Expand response dock"
            }
            onClick={(e) => {
              e.stopPropagation();
              onActiveBottomDockChange(open ? null : "response");
            }}
          >
            <ChevronDown size={14} className="bottom-dock-toggle-chevron" />
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
