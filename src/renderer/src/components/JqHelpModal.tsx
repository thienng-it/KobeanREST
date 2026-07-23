import { HelpCircle, X } from "lucide-react";

export interface JqHelpModalProps {
  open: boolean;
  onClose: () => void;
}

export function JqHelpModal({ open, onClose }: JqHelpModalProps) {
  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 1300 }}
      role="dialog"
      aria-modal="true"
      aria-label="jq Filter Help"
      onClick={onClose}
    >
      <div 
        className="modal" 
        style={{ width: "min(500px, 92vw)", padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--color-border)" }}>
          <h2 style={{ fontSize: "15px", margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
            <HelpCircle size={16} /> jq Filter Help
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "var(--color-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px", borderRadius: "4px" }}
          >
            <X size={16} />
          </button>
        </div>
        
        <div style={{ padding: "16px", flex: 1, overflowY: "auto", fontSize: "13px", color: "var(--color-text)", lineHeight: 1.5 }}>
          <p style={{ margin: "0 0 12px 0" }}>
            You can filter JSON responses using standard <strong>jq</strong> syntax. Here are some examples:
          </p>
          
          <ul style={{ paddingLeft: "20px", margin: "0 0 16px 0", display: "flex", flexDirection: "column", gap: "10px" }}>
            <li>
              <code>.</code> — Returns the entire JSON object unchanged.
            </li>
            <li>
              <code>.data</code> — Access the <code>data</code> property.
            </li>
            <li>
              <code>.data[0]</code> — Access the first item in the <code>data</code> array.
            </li>
            <li>
              <code>.users | map(.name)</code> — Extracts the <code>name</code> field from an array of users.
            </li>
            <li>
              <code>.users[] | select(.age &gt; 25)</code> — Filters the users array to include only those over 25.
            </li>
            <li>
              <code>&#123; id: .id, name: .name &#125;</code> — Creates a new object with only the <code>id</code> and <code>name</code> fields.
            </li>
          </ul>

          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            For more advanced queries, refer to the <a href="https://jqlang.github.io/jq/manual/" target="_blank" rel="noreferrer" style={{ color: "var(--color-accent)", textDecoration: "none" }}>jq manual</a>.
          </p>
        </div>
        
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 16px", borderTop: "1px solid var(--color-border)" }}>
          <button
            type="button"
            className="primary-button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
