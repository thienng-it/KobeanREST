import { HelpCircle, X } from "lucide-react";
import { useI18n } from "../services/i18n";

export interface JqHelpModalProps {
  open: boolean;
  onClose: () => void;
}

export function JqHelpModal({ open, onClose }: JqHelpModalProps) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 1300 }}
      role="dialog"
      aria-modal="true"
      aria-label={t("jqHelp.title", "jq Filter Help")}
      onClick={onClose}
    >
      <div 
        className="modal" 
        style={{ width: "min(500px, 92vw)", padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--color-border)" }}>
          <h2 style={{ fontSize: "15px", margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
            <HelpCircle size={16} /> {t("jqHelp.title", "jq Filter Help")}
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
            {t("jqHelp.desc", "You can filter JSON responses using standard jq syntax. Here are some examples:")}
          </p>
          
          <ul style={{ paddingLeft: "20px", margin: "0 0 16px 0", display: "flex", flexDirection: "column", gap: "10px" }}>
            <li>
              <code>.</code> {t("jqHelp.ex1", "— Returns the entire JSON object unchanged.")}
            </li>
            <li>
              <code>.data</code> {t("jqHelp.ex2", "— Access the data property.")}
            </li>
            <li>
              <code>.data[0]</code> {t("jqHelp.ex3", "— Access the first item in the data array.")}
            </li>
            <li>
              <code>.users | map(.name)</code> {t("jqHelp.ex4", "— Extracts the name field from an array of users.")}
            </li>
            <li>
              <code>.users[] | select(.age &gt; 25)</code> {t("jqHelp.ex5", "— Filters the users array to include only those over 25.")}
            </li>
            <li>
              <code>&#123; id: .id, name: .name &#125;</code> {t("jqHelp.ex6", "— Creates a new object with only the id and name fields.")}
            </li>
          </ul>

          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            {t("jqHelp.footer", "For more advanced queries, refer to the ")}<a href="https://jqlang.github.io/jq/manual/" target="_blank" rel="noreferrer" style={{ color: "var(--color-accent)", textDecoration: "none" }}>jq manual</a>.
          </p>
        </div>
        
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 16px", borderTop: "1px solid var(--color-border)" }}>
          <button
            type="button"
            className="primary-button"
            onClick={onClose}
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
