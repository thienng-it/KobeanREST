import React, { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { WorkspaceSummary } from "../types";
import { CustomSelect } from "./CustomSelect";
import { loadHistory, loadHistoryResponse } from "../services/local-store";
import jq from "jq-web";

interface ChainRequestModalProps {
  isOpen: boolean;
  initialValue: string; // e.g. `$response "Login Request" $.token`
  workspace: WorkspaceSummary | null;
  onClose: () => void;
  onSave: (newValue: string) => void;
}

export function ChainRequestModal({
  isOpen,
  initialValue,
  workspace,
  onClose,
  onSave,
}: ChainRequestModalProps) {
  const [requestRef, setRequestRef] = useState("");
  const [jqPath, setJqPath] = useState("");
  const [rawResponsePayload, setRawResponsePayload] = useState<any>(null);
  const [previewBody, setPreviewBody] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const workspaceRef = useRef(workspace);

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  const lastInitialValue = useRef("");

  useEffect(() => {
    if (isOpen && initialValue && initialValue !== lastInitialValue.current) {
      lastInitialValue.current = initialValue;
      const match = initialValue.match(/^\$response\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))\s+(.+)$/);
      if (match) {
        const rawRef = match[1] || match[2] || match[3] || "";
        const ws = workspaceRef.current;
        const req = ws?.requests.find(r => r.id === rawRef || r.name === rawRef);
        setRequestRef(req ? req.id : rawRef);
        setJqPath(match[4] || "");
      } else {
        setRequestRef("");
        setJqPath("");
      }
    } else if (!isOpen) {
      lastInitialValue.current = "";
      setRequestRef("");
      setJqPath("");
      setRawResponsePayload(null);
      setPreviewBody(null);
    }
  }, [isOpen, initialValue]);

  useEffect(() => {
    if (!requestRef) {
      setRawResponsePayload(null);
      return;
    }

    let active = true;
    setIsLoadingPreview(true);
    setRawResponsePayload(null);

    const fetchPreview = async () => {
      try {
        const ws = workspaceRef.current;
        if (!ws) return;
        const req = ws.requests.find(r => r.id === requestRef || r.name === requestRef);
        if (!req) {
          setIsLoadingPreview(false);
          return;
        }
        
        const history = await loadHistory();
        const entries = history.filter(h => h.requestId === req.id).sort((a, b) => b.id - a.id);
        
        if (entries.length > 0) {
          const payload = await loadHistoryResponse(entries[0].id);
          if (active && payload && payload.responseBodyText) {
            try {
              const parsed = JSON.parse(payload.responseBodyText);
              setRawResponsePayload(parsed);
            } catch (e) {
              setRawResponsePayload(payload.responseBodyText);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load history for preview", err);
      } finally {
        if (active) setIsLoadingPreview(false);
      }
    };

    void fetchPreview();

    return () => { active = false; };
  }, [requestRef]);

  useEffect(() => {
    if (rawResponsePayload === null) {
      setPreviewBody(null);
      return;
    }
    
    if (typeof rawResponsePayload === "string") {
      setPreviewBody(rawResponsePayload);
      return;
    }

    if (!jqPath || !jqPath.trim()) {
      setPreviewBody(JSON.stringify(rawResponsePayload, null, 2));
      return;
    }

    let active = true;
    const applyFilter = async () => {
      try {
        const j = await jq;
        let filter = jqPath.trim();
        if (filter.startsWith("$.")) {
          filter = filter.substring(1);
        }
        const result = j.json(rawResponsePayload, filter);
        if (active) {
          if (result === null) setPreviewBody("null");
          else if (typeof result === "object") setPreviewBody(JSON.stringify(result, null, 2));
          else setPreviewBody(String(result));
        }
      } catch (e) {
        if (active) {
          setPreviewBody(`Filter error: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    };
    
    void applyFilter();
    return () => { active = false; };
  }, [rawResponsePayload, jqPath]);

  if (!isOpen || !workspace) return null;

  const handleSave = () => {
    if (!requestRef || !jqPath) return;
    const req = workspace.requests.find(r => r.id === requestRef);
    
    // Fallback if they selected something or typed manually
    const refToUse = req ? `"${req.name}"` : `"${requestRef}"`;
    
    const finalValue = `$response ${refToUse} ${jqPath}`;
    onSave(finalValue);
    onClose();
  };

  const requestOptions = workspace.requests.map((r) => ({
    value: r.id,
    label: r.name,
  }));

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Edit Chain Request"
      onClick={onClose}
    >
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <div>
            <span className="settings-kicker">Variable</span>
            <h2>Chain Request</h2>
            <p>Extract data from a previous response to use in this request.</p>
          </div>
          <button className="settings-close" type="button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="settings-content">
          <section className="settings-section">
            <div className="settings-section-heading">
              <h3>Source</h3>
              <p>The request you want to extract data from.</p>
            </div>
            <label className="settings-field" style={{ alignItems: "center" }}>
              <span>Source Request</span>
              <CustomSelect
                className="settings-control"
                value={requestRef}
                onChange={(val) => setRequestRef(val)}
                options={requestOptions}
                placeholder="Select a request..."
              />
            </label>
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <h3>Filter</h3>
              <p>Extracts data from the most recent response of the selected request.</p>
            </div>
            <label className="settings-field" style={{ alignItems: "center" }}>
              <span>JSONPath / jq Filter</span>
              <input
                type="text"
                value={jqPath}
                onChange={(e) => setJqPath(e.target.value)}
                placeholder="e.g. $.data.token or .data.token"
                spellCheck={false}
                className="settings-control"
                style={{ flex: 1, minWidth: 0 }}
              />
            </label>
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <h3>Preview</h3>
              <p>The most recent response body for the selected request.</p>
            </div>
            <div className="settings-field" style={{ flexDirection: "column", alignItems: "stretch", marginTop: "8px" }}>
              {isLoadingPreview ? (
                <div style={{ padding: "12px", fontSize: "12px", color: "var(--color-text-muted)" }}>Loading preview...</div>
              ) : previewBody ? (
                <pre style={{ margin: 0, padding: "12px", borderRadius: "6px", backgroundColor: "var(--color-bg-alt)", border: "1px solid var(--color-border)", fontSize: "12px", overflow: "auto", maxHeight: "150px", color: "var(--color-text)" }}>
                  {previewBody}
                </pre>
              ) : (
                <div style={{ padding: "12px", fontSize: "12px", color: "var(--color-text-muted)", fontStyle: "italic" }}>
                  {requestRef ? "No response history found for this request." : "Select a request to view its last response."}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="settings-footer">
          <div style={{ flex: 1 }} />
          <div className="settings-footer-actions">
            <button className="modal-cancel" type="button" onClick={onClose}>
              Cancel
            </button>
            <button 
              className="modal-confirm" 
              type="button" 
              onClick={handleSave}
              disabled={!requestRef || !jqPath}
            >
              Save variable
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
