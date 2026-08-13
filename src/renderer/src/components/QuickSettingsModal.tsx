import React from "react";
import { createPortal } from "react-dom";
import { X, HelpCircle, History, RefreshCw, Wrench, Settings, Moon, Sun, Flame, Monitor } from "lucide-react";
import type { AppSettings } from "../types";

export interface QuickSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: AppSettings["theme"];
  onThemeChange?: (theme: AppSettings["theme"]) => void;
  autoUpdate?: boolean;
  onToggleAutoUpdate?: () => void;
  onOpenDocs?: () => void;
  onOpenHistory?: () => void;
  onCheckForUpdates?: () => void;
  onOpenApiTools?: () => void;
  onOpenSettings?: () => void;
}

export function QuickSettingsModal({
  isOpen,
  onClose,
  theme,
  onThemeChange,
  autoUpdate = true,
  onToggleAutoUpdate,
  onOpenDocs,
  onOpenHistory,
  onCheckForUpdates,
  onOpenApiTools,
  onOpenSettings,
}: QuickSettingsModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000, background: "rgba(0, 0, 0, 0.65)", backdropFilter: "blur(8px)" }}>
      <div
        className="modal quick-settings-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "460px",
          maxWidth: "92vw",
          padding: "24px",
          borderRadius: "20px",
          background: "var(--color-panel, rgba(11, 15, 25, 0.96))",
          border: "1.5px solid rgba(56, 189, 248, 0.4)",
          boxShadow: "0 0 32px rgba(56, 189, 248, 0.25), 0 24px 64px rgba(0, 0, 0, 0.8)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          boxSizing: "border-box",
          userSelect: "none",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--color-text, #ffffff)", letterSpacing: "-0.02em" }}>
              Quick Settings
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--color-text-muted, #94a3b8)" }}>
              Fast access controls and theme customization
            </p>
          </div>
          <button
            type="button"
            className="settings-close"
            onClick={onClose}
            aria-label="Close Quick Settings"
            style={{ width: "30px", height: "30px", border: "none", background: "rgba(255, 255, 255, 0.06)", cursor: "pointer", color: "var(--color-text-muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Section 1: Quick Action Bar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-text-muted, #94a3b8)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Quick Action bar
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px" }}>
            <button
              type="button"
              className="quick-action-card"
              onClick={() => {
                onClose();
                onOpenDocs?.();
              }}
            >
              <div className="quick-action-icon"><HelpCircle size={22} /></div>
              <span className="quick-action-text">Help</span>
            </button>

            <button
              type="button"
              className="quick-action-card"
              onClick={() => {
                onClose();
                onOpenHistory?.();
              }}
            >
              <div className="quick-action-icon"><History size={22} /></div>
              <span className="quick-action-text">History</span>
            </button>

            <button
              type="button"
              className="quick-action-card"
              onClick={() => {
                onClose();
                onCheckForUpdates?.();
              }}
            >
              <div className="quick-action-icon"><RefreshCw size={22} /></div>
              <span className="quick-action-text">Updates</span>
            </button>

            <button
              type="button"
              className="quick-action-card"
              onClick={() => {
                onClose();
                onOpenApiTools?.();
              }}
            >
              <div className="quick-action-icon"><Wrench size={22} /></div>
              <span className="quick-action-text">Tools</span>
            </button>

            <button
              type="button"
              className="quick-action-card"
              onClick={() => {
                onClose();
                onOpenSettings?.();
              }}
            >
              <div className="quick-action-icon"><Settings size={22} /></div>
              <span className="quick-action-text">Settings</span>
            </button>
          </div>
        </div>

        <div style={{ height: "1px", background: "rgba(255, 255, 255, 0.08)" }} />

        {/* Section 2: Theme */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-text-muted, #94a3b8)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Theme
          </div>
          <div className="segmented-theme-control">
            {[
              { id: "dark", label: "Dark", icon: <Moon size={14} /> },
              { id: "light", label: "Light", icon: <Sun size={14} /> },
              { id: "warm", label: "Warm", icon: <Flame size={14} /> },
              { id: "system", label: "System", icon: <Monitor size={14} /> },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                className={`segmented-theme-pill ${theme === t.id ? "active" : ""}`}
                onClick={() => onThemeChange?.(t.id as AppSettings["theme"])}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Section 3: Auto Update */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "4px" }}>
          <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text, #ffffff)" }}>
            Auto Update
          </span>
          <button
            type="button"
            className={`quick-settings-toggle ${autoUpdate ? "on" : "off"}`}
            onClick={() => onToggleAutoUpdate?.()}
          >
            <span className="quick-settings-toggle-handle" />
            <span className="quick-settings-toggle-text">{autoUpdate ? "On" : "Off"}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
