import { useState } from "react";
import { Terminal, X } from "lucide-react";
import { parseCurlCommand } from "../services/script-tools";
import type { CurlImportResult } from "../services/script-tools";

export interface CurlImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (result: CurlImportResult) => void;
}

export function CurlImportModal({ open, onClose, onImport }: CurlImportModalProps) {
  const [curlInput, setCurlInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function handleImport() {
    const trimmed = curlInput.trim();
    if (!trimmed) {
      setError("Paste a curl command to import.");
      return;
    }

    try {
      const result = parseCurlCommand(trimmed);
      if (!result.url) {
        setError("Could not find a URL in the curl command.");
        return;
      }
      onImport(result);
      setCurlInput("");
      setError(null);
    } catch (err) {
      setError("Failed to parse curl command: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  function handleClose() {
    setCurlInput("");
    setError(null);
    onClose();
  }

  return (
    <div
      className="modal-overlay curl-import-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Import from cURL"
      onClick={handleClose}
    >
      <div className="modal curl-import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="curl-import-modal-header">
          <div>
            <span className="curl-import-modal-kicker">Import</span>
            <h2><Terminal size={16} /> Import from cURL</h2>
          </div>
          <button
            type="button"
            className="curl-import-modal-close"
            aria-label="Close curl import"
            onClick={handleClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="curl-import-modal-body">
          <label className="curl-import-label" htmlFor="curl-import-textarea">
            Paste your curl command below
          </label>
          <textarea
            id="curl-import-textarea"
            className="curl-import-textarea"
            value={curlInput}
            onChange={(e) => { setCurlInput(e.target.value); setError(null); }}
            placeholder={`curl -X POST https://api.example.com/data \\
  -H "Content-Type: application/json" \\
  -d '{"key": "value"}'`}
            spellCheck={false}
            autoFocus
          />
          {error && <p className="curl-import-error">{error}</p>}
        </div>
        <div className="curl-import-modal-footer">
          <button
            type="button"
            className="ghost-button"
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleImport}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
