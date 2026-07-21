import { X } from "lucide-react";
import type { AvailableUpdate } from "../services/updater";

export interface UpdateDialogModalProps {
  open: boolean;
  availableUpdate: AvailableUpdate | null;
  updateBusy: boolean;
  progressLabel: string;
  publishedDateLabel: string | null;
  onClose: () => void;
  onInstall: () => void;
}

export function UpdateDialogModal({
  open,
  availableUpdate,
  updateBusy,
  progressLabel,
  publishedDateLabel,
  onClose,
  onInstall,
}: UpdateDialogModalProps) {
  if (!open || !availableUpdate) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Update available"
      onClick={() => {
        if (!updateBusy) onClose();
      }}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "560px", maxWidth: "95vw", display: "flex", flexDirection: "column", gap: "14px" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "16px" }}>Update available</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={updateBusy}
            style={{ all: "unset", cursor: updateBusy ? "not-allowed" : "pointer", opacity: updateBusy ? 0.4 : 1 }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "grid", gap: "6px", fontSize: "13px", color: "var(--color-text)" }}>
          <div>Current version: <strong>{availableUpdate.currentVersion}</strong></div>
          <div>New version: <strong>{availableUpdate.version}</strong></div>
          {publishedDateLabel ? <div>Published: <strong>{publishedDateLabel}</strong></div> : null}
        </div>

        <div style={{ padding: "10px 12px", borderRadius: "6px", background: "var(--color-surface-muted)", border: "1px solid var(--color-border)", color: "var(--color-text)", fontSize: "12px", lineHeight: 1.5 }}>
          Signed release metadata is verified by the Tauri updater plugin before install.
        </div>

        {availableUpdate.body ? (
          <pre className="response-body" style={{ minHeight: "120px", maxHeight: "220px" }}>
            {availableUpdate.body}
          </pre>
        ) : null}

        <div style={{ padding: "10px 12px", borderRadius: "6px", background: "var(--color-surface-muted)", border: "1px solid var(--color-border)", color: "var(--color-muted)", fontSize: "12px", lineHeight: 1.5 }}>
          {progressLabel}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            className="modal-cancel"
            type="button"
            disabled={updateBusy}
            onClick={onClose}
          >
            Later
          </button>
          <button
            className="modal-confirm"
            type="button"
            disabled={updateBusy}
            onClick={() => void onInstall()}
          >
            {updateBusy ? "Installing update" : "Install update"}
          </button>
        </div>
      </div>
    </div>
  );
}
