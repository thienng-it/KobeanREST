import { X } from "lucide-react";
import { ConfirmDialog, type ConfirmDialogProps } from "./ConfirmDialog";
import { HistoryModal, type HistoryModalProps } from "./HistoryModal";
import { SettingsModal, type SettingsModalProps } from "./SettingsModal";
import { AuthEditorModal, type AuthEditorModalProps } from "./AuthEditorModal";
import { UpdateDialogModal, type UpdateDialogModalProps } from "./UpdateDialogModal";
import { EnvironmentEditorModal, type EnvironmentEditorModalProps } from "./EnvironmentEditorModal";
import { RequestCodeModal, type RequestCodeModalProps } from "./RequestCodeModal";
import { FolderScriptsModal, type FolderScriptsModalProps } from "./FolderScriptsModal";
import { CollectionEditorModal, type CollectionEditorModalProps } from "./CollectionEditorModal";
import { CurlImportModal, type CurlImportModalProps } from "./CurlImportModal";
import { ResponsePanel, type ResponseTab } from "./ResponsePanel";
import { type PreviewMode } from "../response-utils";
import type { ExecuteHttpResponse } from "../types";
import type { ResponseState } from "../response-utils";

interface ResponseWindowProps {
  open: boolean;
  responseState: ResponseState;
  currentResponse: ExecuteHttpResponse | undefined;
  responseTitle: string;
  responseTitleColor: string;
  isResponseTabPending: boolean;
  responseTab: ResponseTab;
  previewMode: PreviewMode;
  activeBottomDock: "response" | null;
  onTabChange: (tab: ResponseTab) => void;
  onPreviewModeChange: (mode: PreviewMode) => void;
  onDownload: () => void;
  onCopy: () => void;
  onOpenWindow: () => void;
  onResizerMouseDown: () => void;
  onClose: () => void;
}

export interface ModalManagerProps {
  confirmDialog: ConfirmDialogProps["dialog"];
  onCancelConfirmDialog: () => void;
  history: HistoryModalProps;
  settings: SettingsModalProps;
  auth: AuthEditorModalProps;
  update: UpdateDialogModalProps;
  env: EnvironmentEditorModalProps;
  requestCode: RequestCodeModalProps;
  folderScripts: FolderScriptsModalProps;
  collectionEditor: CollectionEditorModalProps;
  curlImport: CurlImportModalProps;
  responseWindow: ResponseWindowProps;
}

export function ModalManager({
  confirmDialog,
  onCancelConfirmDialog,
  history,
  settings,
  auth,
  update,
  env,
  requestCode,
  folderScripts,
  collectionEditor,
  curlImport,
  responseWindow,
}: ModalManagerProps) {
  return (
    <>
      <ConfirmDialog dialog={confirmDialog} onCancel={onCancelConfirmDialog} />
      <HistoryModal {...history} />
      <SettingsModal {...settings} />
      <AuthEditorModal {...auth} />
      <UpdateDialogModal {...update} />
      <EnvironmentEditorModal {...env} />
      <RequestCodeModal {...requestCode} />
      <FolderScriptsModal {...folderScripts} />
      <CollectionEditorModal {...collectionEditor} />
      <CurlImportModal {...curlImport} />

      {responseWindow.open && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Response window"
          onClick={responseWindow.onClose}
        >
          <div
            className="modal response-window-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="response-window-titlebar">
              <div>
                <span className="response-window-kicker">Response window</span>
                <h2 className="response-window-title" style={{ color: responseWindow.responseTitleColor }}>
                  {responseWindow.responseTitle}
                </h2>
              </div>
              <button
                className="response-window-close"
                type="button"
                onClick={responseWindow.onClose}
              >
                <X size={15} /> Close
              </button>
            </div>
            <ResponsePanel
              variant="modal"
              responseState={responseWindow.responseState}
              currentResponse={responseWindow.currentResponse}
              responseTitle={responseWindow.responseTitle}
              responseTitleColor={responseWindow.responseTitleColor}
              isResponseTabPending={responseWindow.isResponseTabPending}
              responseTab={responseWindow.responseTab}
              previewMode={responseWindow.previewMode}
              activeBottomDock={responseWindow.activeBottomDock}
              onTabChange={responseWindow.onTabChange}
              onPreviewModeChange={responseWindow.onPreviewModeChange}
              onDownload={responseWindow.onDownload}
              onCopy={responseWindow.onCopy}
              onOpenWindow={responseWindow.onOpenWindow}
              onResizerMouseDown={responseWindow.onResizerMouseDown}
            />
          </div>
        </div>
      )}
    </>
  );
}
