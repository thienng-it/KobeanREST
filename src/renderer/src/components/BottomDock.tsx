import { ChevronDown, Eye } from "lucide-react";
import { ResponsePanel, type PreviewMode, type ResponseTab } from "./ResponsePanel";
import type { ExecuteHttpResponse } from "../types";
import type { ResponseState } from "../response-utils";

export interface BottomDockProps {
  activeBottomDock: "response" | null;
  bottomDockHeight: number;
  bottomDockStripHeight: number;
  responseState: ResponseState;
  currentResponse: ExecuteHttpResponse | undefined;
  responseTitle: string;
  responseTitleColor: string;
  isResponseTabPending: boolean;
  responseTab: ResponseTab;
  previewMode: PreviewMode;
  onActiveBottomDockChange: (dock: "response" | null) => void;
  onTabChange: (tab: ResponseTab) => void;
  onPreviewModeChange: (mode: PreviewMode) => void;
  onDownload: () => void;
  onCopy: () => void;
  onOpenWindow: () => void;
  onResizerMouseDown: () => void;
}

export function BottomDock({
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
  onActiveBottomDockChange,
  onTabChange,
  onPreviewModeChange,
  onDownload,
  onCopy,
  onOpenWindow,
  onResizerMouseDown,
}: BottomDockProps) {
  const open = activeBottomDock === "response";
  return (
    <section
      className="bottom-dock"
      aria-label="Bottom dock"
      style={{ height: open ? `${bottomDockHeight + bottomDockStripHeight}px` : `${bottomDockStripHeight}px` }}
    >
      <div className="bottom-dock-strip">
        <button
          className={open ? "bottom-dock-tab active" : "bottom-dock-tab"}
          type="button"
          onClick={() => onActiveBottomDockChange("response")}
        >
          <Eye size={14} /> Response
        </button>
        <button
          className={open ? "bottom-dock-collapse expanded" : "bottom-dock-collapse collapsed"}
          type="button"
          aria-label={open ? "Collapse response dock" : "Expand response dock"}
          onClick={() => onActiveBottomDockChange(open ? null : "response")}
        >
          <ChevronDown size={14} />
        </button>
      </div>
      <div className="bottom-dock-panels">
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
          onTabChange={onTabChange}
          onPreviewModeChange={onPreviewModeChange}
          onDownload={onDownload}
          onCopy={onCopy}
          onOpenWindow={onOpenWindow}
          onResizerMouseDown={onResizerMouseDown}
        />
      </div>
    </section>
  );
}
