import React, { useState } from "react";
import { X } from "lucide-react";

export interface AdvancedSendModalProps {
  open: boolean;
  mode: "delay" | "interval" | null;
  onClose: () => void;
  onSubmit: (ms: number) => void;
}

export function AdvancedSendModal({ open, mode, onClose, onSubmit }: AdvancedSendModalProps) {
  const [seconds, setSeconds] = useState("5");

  if (!open || !mode) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()} style={{ width: "420px", height: "auto" }}>
        <div className="settings-header">
          <div>
            <span className="settings-kicker">Advanced Send</span>
            <h2>{mode === "delay" ? "Send after delay" : "Repeat on interval"}</h2>
            <p>
              {mode === "delay"
                ? "Configure a delay before sending the request."
                : "Configure an interval to repeatedly send the request."}
            </p>
          </div>
          <button className="settings-close" type="button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="settings-content" style={{ paddingBottom: "16px" }}>
          <section className="settings-section">
            <label className="settings-row" style={{ borderBottom: "none", paddingBottom: 0 }}>
              <span style={{ flex: 1 }}>
                <strong>Duration (seconds)</strong>
                <small>Enter the time in seconds.</small>
              </span>
              <input
                type="number"
                autoFocus
                min="1"
                className="input"
                style={{ width: "100px" }}
                value={seconds}
                onChange={(e) => setSeconds(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const num = parseInt(seconds, 10);
                    if (!isNaN(num) && num > 0) {
                      onSubmit(num * 1000);
                    }
                  }
                  if (e.key === "Escape") {
                    onClose();
                  }
                }}
              />
            </label>
          </section>
        </div>

        <div className="settings-footer" style={{ justifyContent: "flex-end" }}>
          <div className="settings-footer-actions">
            <button className="modal-cancel" type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="modal-confirm"
              type="button"
              onClick={() => {
                const num = parseInt(seconds, 10);
                if (!isNaN(num) && num > 0) {
                  onSubmit(num * 1000);
                }
              }}
            >
              Start
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
