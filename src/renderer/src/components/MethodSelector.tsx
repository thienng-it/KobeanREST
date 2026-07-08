import React, { useRef, useState, useEffect } from "react";
import { HttpMethod } from "../types";

const PRESET_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "CUSTOM"];

/** Returns the CSS class suffix for a given method string (lowercased for known ones, "custom" for all others). */
export function methodClass(method: string): string {
  const upper = method.toUpperCase();
  const known = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
  if (known.includes(upper)) return upper.toLowerCase();
  return "custom";
}

/** Resolves the display label: for CUSTOM shows the actual customMethod value (or "CUSTOM" fallback). */
export function resolvedMethodLabel(method: HttpMethod, customMethod?: string): string {
  if (method === "CUSTOM") return (customMethod?.trim().toUpperCase() || "CUSTOM");
  return method;
}

interface MethodSelectorProps {
  method: HttpMethod;
  customMethod?: string;
  onChange: (method: HttpMethod, customMethod?: string) => void;
}

export function MethodSelector({ method, customMethod, onChange }: MethodSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const label = resolvedMethodLabel(method, customMethod);
  const cls = methodClass(label);

  return (
    <div className="method-selector" ref={ref}>
      {/* Trigger button */}
      <button
        type="button"
        className={`method-selector-btn method-${cls}`}
        aria-label="HTTP method"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <span className="method-selector-caret" aria-hidden="true">▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="method-selector-dropdown" role="listbox" aria-label="Select HTTP method">
          {PRESET_METHODS.map((m) => (
            <button
              key={m}
              type="button"
              role="option"
              aria-selected={method === m}
              className={`method-selector-option ${method === m ? "selected" : ""}`}
              onClick={() => {
                onChange(m, m === "CUSTOM" ? customMethod : undefined);
                if (m !== "CUSTOM") setOpen(false);
              }}
            >
              <span className={`method method-${methodClass(m)}`}>
                {m === "CUSTOM" ? "CUSTOM" : m}
              </span>
            </button>
          ))}

          {/* Custom method inline input */}
          {method === "CUSTOM" && (
            <div className="method-selector-custom-input">
              <input
                autoFocus
                type="text"
                placeholder="e.g. TRACE, QUERY, SEARCH…"
                value={customMethod || ""}
                onChange={(e) => onChange("CUSTOM", e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape") setOpen(false);
                }}
                aria-label="Custom HTTP method"
                maxLength={24}
                spellCheck={false}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
