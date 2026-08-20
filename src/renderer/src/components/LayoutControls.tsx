import React from "react";
import { Columns, Rows } from "lucide-react";

export interface LayoutControlsProps {
  layoutMode: "stacked" | "split";
  onLayoutModeChange: (mode: "stacked" | "split") => void;
  uiDensity?: "comfortable" | "compact";
  onToggleDensity?: () => void;
}

export function LayoutControls({
  layoutMode,
  onLayoutModeChange,
  uiDensity,
  onToggleDensity,
}: LayoutControlsProps) {
  return (
    <div className="layout-controls" style={{ display: "flex", alignItems: "center", gap: "2px" }}>
      <button
        type="button"
        className={`icon-btn layout-mode-btn ${layoutMode === "split" ? "active" : ""}`}
        onClick={() => onLayoutModeChange(layoutMode === "split" ? "stacked" : "split")}
        title={layoutMode === "split" ? "Switch to Stacked View (Cmd+\\)" : "Switch to Side-by-Side Split View (Cmd+\\)"}
        aria-label={layoutMode === "split" ? "Switch to Stacked View" : "Switch to Side-by-Side Split View"}
        style={{
          padding: "4px 8px",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          background: layoutMode === "split" ? "var(--color-surface-active)" : "transparent",
          border: "none",
          borderRadius: "6px",
          color: layoutMode === "split" ? "var(--color-accent, #3b82f6)" : "var(--color-text-muted)",
          cursor: "pointer",
          fontSize: "12px",
          fontWeight: 500,
          flexShrink: 0,
        }}
      >
        {layoutMode === "split" ? <Columns size={14} /> : <Rows size={14} />}
        <span>{layoutMode === "split" ? "Split" : "Stacked"}</span>
      </button>
    </div>
  );
}
