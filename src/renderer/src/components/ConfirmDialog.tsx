export interface ConfirmDialogProps {
  dialog: { message: string; onConfirm: () => void } | null;
  onCancel: () => void;
}

export function ConfirmDialog({ dialog, onCancel }: ConfirmDialogProps) {
  if (!dialog) return null;

  return (
    <div
      className="modal-overlay confirm-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm action"
      onClick={onCancel}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p className="modal-message">{dialog.message}</p>
        <div className="modal-actions">
          <button className="modal-cancel" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="modal-confirm"
            type="button"
            onClick={() => {
              dialog.onConfirm();
              onCancel();
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
