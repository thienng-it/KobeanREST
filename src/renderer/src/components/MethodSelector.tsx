import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";
import { HttpMethod } from "../types";

const PRESET_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "CUSTOM"];
const DROPDOWN_GAP = 6;
const VIEWPORT_PADDING = 16;
const DROPDOWN_MIN_HEIGHT = 120;
const DROPDOWN_MAX_HEIGHT = 360;

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

interface DropdownLayout {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: "top" | "bottom";
}

export function getMethodDropdownLayout(
  triggerRect: Pick<DOMRect, "top" | "bottom" | "left" | "width">,
  menuHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): DropdownLayout {
  const width = Math.max(Math.round(triggerRect.width), 150);
  const left = Math.min(
    Math.max(VIEWPORT_PADDING, Math.round(triggerRect.left)),
    Math.max(VIEWPORT_PADDING, viewportWidth - width - VIEWPORT_PADDING),
  );
  const availableBelow = Math.max(viewportHeight - triggerRect.bottom - VIEWPORT_PADDING, 0);
  const availableAbove = Math.max(triggerRect.top - VIEWPORT_PADDING, 0);
  const placement =
    availableBelow < Math.min(menuHeight, 240) && availableAbove > availableBelow
      ? "top"
      : "bottom";
  const availableSpace = placement === "top" ? availableAbove : availableBelow;
  const maxHeight = Math.max(
    DROPDOWN_MIN_HEIGHT,
    Math.min(DROPDOWN_MAX_HEIGHT, Math.floor(availableSpace)),
  );
  const renderedHeight = Math.min(menuHeight, maxHeight);
  const top =
    placement === "top"
      ? Math.max(VIEWPORT_PADDING, Math.round(triggerRect.top - DROPDOWN_GAP - renderedHeight))
      : Math.min(
          Math.round(triggerRect.bottom + DROPDOWN_GAP),
          Math.max(VIEWPORT_PADDING, viewportHeight - VIEWPORT_PADDING - renderedHeight),
        );

  return { left, top, width, maxHeight, placement };
}

interface MethodSelectorProps {
  method: HttpMethod;
  customMethod?: string;
  onChange: (method: HttpMethod, customMethod?: string) => void;
}

export function MethodSelector({ method, customMethod, onChange }: MethodSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownLayout, setDropdownLayout] = useState<DropdownLayout | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || dropdownRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const updateLayout = () => {
      if (!buttonRef.current) return;
      const triggerRect = buttonRef.current.getBoundingClientRect();
      const menuHeight = dropdownRef.current?.scrollHeight ?? 320;
      setDropdownLayout(
        getMethodDropdownLayout(triggerRect, menuHeight, window.innerWidth, window.innerHeight),
      );
    };

    updateLayout();
    const frame = window.requestAnimationFrame(updateLayout);
    window.addEventListener("resize", updateLayout);
    window.addEventListener("scroll", updateLayout, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateLayout);
      window.removeEventListener("scroll", updateLayout, true);
    };
  }, [open, method]);

  useEffect(() => {
    if (!open) {
      setDropdownLayout(null);
    }
  }, [open]);

  const label = resolvedMethodLabel(method, customMethod);
  const cls = methodClass(label);

  return (
    <div className="method-selector" ref={ref}>
      {/* Trigger button */}
      <button
        ref={buttonRef}
        type="button"
        className={`method-selector-btn method-${cls} ${open ? "open" : ""}`}
        aria-label="HTTP method"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <ChevronDown
          className={`method-selector-caret ${open ? "open" : ""}`}
          aria-hidden="true"
          size={18}
          strokeWidth={2.4}
        />
      </button>

      {/* Dropdown */}
      {open && createPortal(
        <div
          ref={dropdownRef}
          className="method-selector-dropdown"
          role="listbox"
          aria-label="Select HTTP method"
          data-placement={dropdownLayout?.placement ?? "bottom"}
          style={{
            top: dropdownLayout?.top ?? 0,
            left: dropdownLayout?.left ?? 0,
            width: dropdownLayout?.width,
            maxHeight: dropdownLayout?.maxHeight,
            visibility: dropdownLayout ? "visible" : "hidden",
          }}
        >
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
        </div>,
        document.body,
      )}
    </div>
  );
}
