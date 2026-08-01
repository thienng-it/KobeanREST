import { X, Copy, Check } from "lucide-react";
import type { RequestCodeSnippetTarget } from "../services/script-tools";
import { CustomSelect } from "./CustomSelect";
import { CodeSnippetViewer } from "./CodeSnippetViewer";
import { useState } from "react";

export interface RequestCodeModalProps {
  open: boolean;
  codeSnippet: string;
  codeTarget: RequestCodeSnippetTarget;
  onClose: () => void;
  onTargetChange: (target: RequestCodeSnippetTarget) => void;
  onInsert: () => void;
}

export function RequestCodeModal({
  open,
  codeSnippet,
  codeTarget,
  onClose,
  onTargetChange,
  onInsert,
}: RequestCodeModalProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(codeSnippet);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error("Failed to copy code snippet", err);
    }
  };

  if (!open) return null;

  return (
    <div
      className="modal-overlay script-code-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Request code"
      onClick={onClose}
    >
      <div className="modal script-code-modal" onClick={(event) => event.stopPropagation()}>
        <div className="script-code-modal-header">
          <div>
            <span className="script-code-modal-kicker">Generated client</span>
            <h2>Request code</h2>
          </div>
          <button
            type="button"
            className="script-code-modal-close"
            aria-label="Close request code"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="script-code-modal-toolbar">
          <CustomSelect
            className="script-tool-select"
            value={codeTarget}
            onChange={(val) => onTargetChange(val as RequestCodeSnippetTarget)}
            ariaLabel="Request code snippet target"
            options={[
              { value: "curl", label: "cURL" },
              { value: "fetch", label: "Fetch" },
              { value: "node", label: "Node" },
              { value: "python", label: "Python (requests)" },
              { value: "go", label: "Go" },
              { value: "java", label: "Java (HttpClient)" }
            ]}
          />
          <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
            <button
              className="ghost-button script-tool-action"
              type="button"
              onClick={handleCopyCode}
              aria-label="Copy code snippet"
              title="Copy to clipboard"
            >
              {copiedCode ? <Check size={14} style={{ color: "var(--color-success)" }} /> : <Copy size={14} />}
              {copiedCode ? "Copied!" : "Copy"}
            </button>
            <button
              className="ghost-button script-tool-action"
              type="button"
              onClick={onInsert}
              aria-label="Insert request code snippet"
            >
              Insert into script
            </button>
          </div>
        </div>
        <div className="script-code-modal-preview">
          <CodeSnippetViewer value={codeSnippet} language={codeTarget} />
        </div>
      </div>
    </div>
  );
}
