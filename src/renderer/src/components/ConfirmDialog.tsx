export interface ConfirmDialogState {
  title?: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: "primary" | "danger";
  onConfirm: () => void;
  altLabel?: string;
  onAlt?: () => void;
}

export interface ConfirmDialogProps {
  dialog: ConfirmDialogState | null;
  onCancel: () => void;
}

export function ConfirmDialog({ dialog, onCancel }: ConfirmDialogProps) {
  if (!dialog) return null;

  const isDanger = dialog.confirmVariant === "danger";

  return (
    <div
      className="modal-overlay confirm-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={dialog.title || "Confirm action"}
      onClick={onCancel}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: "420px", padding: "20px" }}>
        {dialog.title && (
          <h2 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 8px 0", color: "var(--color-text)" }}>
            {dialog.title}
          </h2>
        )}
        <p className="modal-message" style={{ margin: "0 0 20px 0", fontSize: "13.5px", color: "var(--color-text-secondary, var(--color-muted))" }}>
          {dialog.message}
        </p>
        <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button className="modal-cancel ghost-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          {dialog.altLabel && (
            <button
              className="primary-button"
              style={{ backgroundColor: "var(--color-bg-tertiary)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
              type="button"
              onClick={() => {
                dialog.onAlt?.();
                onCancel();
              }}
            >
              {dialog.altLabel}
            </button>
          )}
          <button
            className={isDanger ? "modal-confirm danger-button" : "primary-button"}
            type="button"
            onClick={() => {
              dialog.onConfirm();
              onCancel();
            }}
          >
            {dialog.confirmLabel || (isDanger ? "Delete" : "Confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
