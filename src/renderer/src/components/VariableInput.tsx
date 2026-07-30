import React, { useRef, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, Check, Copy, X, Plus } from "lucide-react";
import { EnvironmentVariable } from "../types";
import { saveVariable } from "../services/local-store";
import { redactDiagnosticError } from "../services/redaction";

const VARIABLE_PATTERN = /(\{\{[^{}]+\}\})/g;

interface TooltipState {
  key: string;
  value: string;
  isSecret: boolean;
  isResolved: boolean;
  x: number;
  y: number;
  placement?: "top" | "bottom";
}

export interface VariablePopoverCardProps {
  tooltipKey: string;
  tooltipValue: string;
  isResolved: boolean;
  x: number;
  y: number;
  placement?: "top" | "bottom";
  activeEnvironmentName?: string;
  onSaveVariable?: (envName: string, key: string, value: string) => Promise<void> | void;
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onInputFocus: () => void;
}

export function VariablePopoverCard({
  tooltipKey,
  tooltipValue,
  isResolved,
  x,
  y,
  placement = "top",
  activeEnvironmentName,
  onSaveVariable,
  onClose,
  onMouseEnter,
  onMouseLeave,
  onInputFocus,
}: VariablePopoverCardProps) {
  const [editValue, setEditValue] = useState(tooltipValue);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const isBottom = placement === "bottom";

  useEffect(() => {
    setEditValue(tooltipValue);
    setSavedSuccess(false);
  }, [tooltipKey, tooltipValue]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const targetEnv = activeEnvironmentName || "Environment";
      if (onSaveVariable) {
        await onSaveVariable(targetEnv, tooltipKey, editValue);
      } else {
        await saveVariable(targetEnv, tooltipKey, editValue);
      }
      setSavedSuccess(true);
      setTimeout(() => {
        onClose();
      }, 250);
    } catch (err) {
      console.error("Failed to save variable from popover:", redactDiagnosticError(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = () => {
    if (!editValue) return;
    void navigator.clipboard.writeText(editValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return createPortal(
    <div
      className={`variable-popover-card placement-${placement}`}
      style={{
        position: "fixed",
        left: `${x}px`,
        top: `${y}px`,
        transform: isBottom ? "translate(-50%, 0)" : "translate(-50%, -100%)",
        zIndex: 999999,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="variable-popover-header">
        <div className="variable-popover-title">
          <span className="variable-popover-braces">{"{{"}</span>
          <span className="variable-popover-name">{tooltipKey}</span>
          <span className="variable-popover-braces">{"}}"}</span>
        </div>
        <div className="variable-popover-header-right">
          <span className={`variable-popover-badge ${isResolved ? "resolved" : "unresolved"}`}>
            {isResolved ? activeEnvironmentName || "Environment" : "Unresolved"}
          </span>
          <button
            type="button"
            className="variable-popover-close-btn"
            onClick={onClose}
            title="Close"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      <div className="variable-popover-body">
        <div className="variable-popover-field">
          <div className="variable-popover-input-wrapper">
            <input
              type="text"
              className="variable-popover-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onFocus={onInputFocus}
              onKeyDown={handleKeyDown}
              placeholder={isResolved ? "Enter variable value..." : "Set variable value..."}
            />
            {editValue && (
              <button
                type="button"
                className="variable-popover-icon-btn"
                onClick={handleCopy}
                title="Copy value"
              >
                {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
              </button>
            )}
          </div>
        </div>

        <div className="variable-popover-actions">
          <button
            type="button"
            className={`variable-popover-save-btn ${savedSuccess ? "saved" : ""}`}
            onClick={() => void handleSave()}
            disabled={isSaving}
          >
            {savedSuccess ? (
              <>
                <Check size={12} /> Saved!
              </>
            ) : isResolved ? (
              "Update Variable"
            ) : (
              <>
                <Plus size={12} /> Add to Environment
              </>
            )}
          </button>
        </div>
      </div>

      <div className={`variable-popover-arrow ${isBottom ? "arrow-top" : "arrow-bottom"}`} />
    </div>,
    document.body
  );
}

export interface VariableInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  activeVariables: EnvironmentVariable[];
  activeEnvironmentName?: string;
  onSaveVariable?: (envName: string, key: string, value: string) => Promise<void> | void;
  containerStyle?: React.CSSProperties;
  containerClassName?: string;
  suggestions?: string[];
  suggestionBadge?: string;
}

export function VariableInput({
  activeVariables,
  activeEnvironmentName,
  onSaveVariable,
  value = "",
  onChange,
  onScroll,
  onFocus,
  onBlur,
  onKeyUp,
  onKeyDown,
  onSelect,
  onDoubleClick,
  style,
  className,
  containerStyle,
  containerClassName,
  suggestions,
  suggestionBadge,
  ...rest
}: VariableInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const isHoveringPopoverRef = useRef(false);
  const isPinnedRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isFocused, setIsFocused] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<TooltipState | null>(null);

  const [autocomplete, setAutocomplete] = useState<{
    prefix: string;
    options: EnvironmentVariable[];
    selectedIndex: number;
    startOffset: number;
  } | null>(null);

  const [suggestionState, setSuggestionState] = useState<{
    open: boolean;
    selectedIndex: number;
  }>({ open: true, selectedIndex: 0 });

  const [showPassword, setShowPassword] = useState(false);
  const isPasswordProp = rest.type === "password";
  const actualType = isPasswordProp && !showPassword ? "password" : isPasswordProp ? "text" : rest.type;

  const strValue = String(value);
  const hasVariables = actualType !== "password" && /\{\{[^{}]+\}\}/.test(strValue);

  const filteredSuggestions = useCallback(() => {
    if (!suggestions || suggestions.length === 0) return [];
    const val = strValue.trim().toLowerCase();
    if (!val) return suggestions;
    return suggestions.filter((s) => s.toLowerCase().includes(val));
  }, [suggestions, strValue])();

  const handleApplySuggestion = useCallback(
    (sug: string) => {
      if (onChange) {
        const syntheticEvent = { target: { value: sug } } as any;
        onChange(syntheticEvent);
      }
      setSuggestionState({ open: false, selectedIndex: 0 });
    },
    [onChange]
  );

  const cancelCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    if (isPinnedRef.current || isHoveringPopoverRef.current) return;
    cancelCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      if (!isPinnedRef.current && !isHoveringPopoverRef.current) {
        setActiveTooltip(null);
      }
    }, 300);
  }, [cancelCloseTimer]);

  const closePopoverImmediately = useCallback(() => {
    cancelCloseTimer();
    isPinnedRef.current = false;
    isHoveringPopoverRef.current = false;
    setActiveTooltip(null);
  }, [cancelCloseTimer]);

  // Click outside to dismiss pinned popover
  useEffect(() => {
    if (!activeTooltip) return;

    function handlePointerDownOutside(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closePopoverImmediately();
      }
    }

    window.addEventListener("pointerdown", handlePointerDownOutside);
    return () => window.removeEventListener("pointerdown", handlePointerDownOutside);
  }, [activeTooltip, closePopoverImmediately]);

  const checkAutocomplete = () => {
    const el = inputRef.current || (backdropRef.current?.parentElement?.querySelector("textarea") as HTMLTextAreaElement);
    if (!el) return;
    const val = el.value;
    const cursor = el.selectionStart ?? 0;
    const beforeCursor = val.slice(0, cursor);
    const match = beforeCursor.match(/\{\{([^{}]*)$/);
    if (match) {
      const prefix = match[1].toLowerCase();
      const options = activeVariables.filter((v) => v.key.toLowerCase().includes(prefix));
      if (options.length > 0) {
        setAutocomplete((prev) => ({
          prefix,
          options,
          selectedIndex: prev ? Math.min(prev.selectedIndex, options.length - 1) : 0,
          startOffset: match.index!,
        }));
        return;
      }
    }
    setAutocomplete(null);
  };

  const applyAutocomplete = (variable: EnvironmentVariable) => {
    if (!autocomplete) return;
    const el = inputRef.current || (backdropRef.current?.parentElement?.querySelector("textarea") as HTMLTextAreaElement);
    if (!el) return;
    const val = strValue;
    const start = autocomplete.startOffset;
    const cursor = el.selectionStart ?? start + 2;
    const newVal = val.slice(0, start) + "{{" + variable.key + "}}" + val.slice(cursor);

    if (onChange) {
      const syntheticEvent = { target: { value: newVal } } as any;
      onChange(syntheticEvent);
    }
    setAutocomplete(null);
    setTimeout(() => {
      const currentEl = inputRef.current || (backdropRef.current?.parentElement?.querySelector("textarea") as HTMLTextAreaElement);
      if (currentEl) {
        const newCursor = start + 4 + variable.key.length;
        currentEl.setSelectionRange(newCursor, newCursor);
        currentEl.focus();
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (suggestions && suggestions.length > 0 && isFocused && filteredSuggestions.length > 0 && suggestionState.open !== false) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSuggestionState((prev) => ({
          open: true,
          selectedIndex: (prev.selectedIndex + 1) % filteredSuggestions.length,
        }));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSuggestionState((prev) => ({
          open: true,
          selectedIndex: (prev.selectedIndex - 1 + filteredSuggestions.length) % filteredSuggestions.length,
        }));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        const item = filteredSuggestions[suggestionState.selectedIndex || 0];
        if (item) {
          e.preventDefault();
          handleApplySuggestion(item);
          return;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSuggestionState({ open: false, selectedIndex: 0 });
        return;
      }
    }

    if (autocomplete) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAutocomplete((prev) => (prev ? { ...prev, selectedIndex: (prev.selectedIndex + 1) % prev.options.length } : null));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setAutocomplete((prev) => (prev ? { ...prev, selectedIndex: (prev.selectedIndex - 1 + prev.options.length) % prev.options.length } : null));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        applyAutocomplete(autocomplete.options[autocomplete.selectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setAutocomplete(null);
        return;
      }
    }
    syncScroll();
    if (onKeyDown) onKeyDown(e as any);
  };

  const syncScroll = () => {
    if (inputRef.current && backdropRef.current) {
      backdropRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  };

  const syncStyles = () => {
    if (inputRef.current && backdropRef.current) {
      const inputStyle = window.getComputedStyle(inputRef.current);
      const backdrop = backdropRef.current;

      const stylesToSync = [
        "fontFamily",
        "fontSize",
        "lineHeight",
        "fontWeight",
        "letterSpacing",
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft",
        "textTransform",
        "textAlign",
        "wordSpacing",
      ];

      stylesToSync.forEach((prop) => {
        // @ts-ignore
        backdrop.style[prop] = inputStyle[prop];
      });
    }
  };

  useEffect(() => {
    syncStyles();
    syncScroll();
  }, [strValue, isFocused]);

  useEffect(() => {
    syncStyles();
    window.addEventListener("resize", syncStyles);
    return () => window.removeEventListener("resize", syncStyles);
  }, []);

  const showTooltipForSpan = useCallback(
    (span: Element) => {
      const varName = (span as HTMLElement).dataset.varname;
      if (!varName) return;

      const variable = activeVariables.find((v) => v.key === varName);
      const isResolved = !!variable;
      const val = isResolved ? variable!.value : "";

      const parentRect = containerRef.current!.getBoundingClientRect();
      const spanRect = span.getBoundingClientRect();

      const spaceAbove = spanRect.top;
      const placement: "top" | "bottom" = spaceAbove < 180 ? "bottom" : "top";

      const y = placement === "top"
        ? spanRect.top - 6
        : spanRect.bottom + 6;

      setActiveTooltip({
        key: varName,
        value: val,
        isSecret: false,
        isResolved,
        x: spanRect.left + spanRect.width / 2,
        y,
        placement,
      });
    },
    [activeVariables]
  );

  const lastMoveTimeRef = useRef(0);
  const handleInputMouseMove = useCallback(
    (e: React.MouseEvent<HTMLInputElement>) => {
      const now = Date.now();
      if (now - lastMoveTimeRef.current < 30) return;
      lastMoveTimeRef.current = now;

      if (isPinnedRef.current || isHoveringPopoverRef.current) return;

      const input = inputRef.current;
      if (!input) return;

      input.style.pointerEvents = "none";
      const elemBelow = document.elementFromPoint(e.clientX, e.clientY);
      input.style.pointerEvents = "";

      if (elemBelow && elemBelow.classList.contains("variable-highlight") && elemBelow.classList.contains("resolved")) {
        cancelCloseTimer();
        const varName = (elemBelow as HTMLElement).dataset.varname;
        if (activeTooltip?.key === varName) return; // already showing
        showTooltipForSpan(elemBelow);
      } else {
        scheduleClose();
      }
    },
    [showTooltipForSpan, cancelCloseTimer, scheduleClose, activeTooltip]
  );

  const renderHighlightedText = () => {
    if (!strValue) return null;
    const parts = strValue.split(VARIABLE_PATTERN);

    return parts.map((part, index) => {
      const isVar = part.startsWith("{{") && part.endsWith("}}");
      if (isVar) {
        const varName = part.slice(2, -2).trim();
        const exists = activeVariables.some((v) => v.key === varName);
        const isActivePopover = activeTooltip?.key === varName;
        const spanClassName = exists
          ? `variable-highlight resolved ${isActivePopover ? "active-popover" : ""}`
          : `variable-highlight unresolved ${isActivePopover ? "active-popover" : ""}`;

        return (
          <span key={index} className={spanClassName} data-varname={varName}>
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div
      ref={containerRef}
      className={`variable-input-container ${isFocused ? "focused" : ""} ${containerClassName || ""}`}
      style={{
        position: "relative",
        display: "inline-flex",
        width: "100%",
        boxSizing: "border-box",
        ...containerStyle,
      }}
    >
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="variable-input-backdrop"
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: hasVariables ? "block" : "none",
          pointerEvents: "none",
          whiteSpace: "pre",
          overflow: "hidden",
          boxSizing: "border-box",
          backgroundColor: "transparent",
        }}
      >
        {hasVariables ? renderHighlightedText() : null}
      </div>

      {/* Input */}
      <input
        ref={inputRef}
        value={value}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        onChange={(e) => {
          if (onChange) onChange(e);
          if (!isPinnedRef.current) closePopoverImmediately();
          setTimeout(() => {
            syncScroll();
            checkAutocomplete();
          }, 0);
        }}
        onScroll={(e) => {
          syncScroll();
          if (onScroll) onScroll(e);
          if (!isPinnedRef.current) closePopoverImmediately();
        }}
        onFocus={(e) => {
          setIsFocused(true);
          if (onFocus) onFocus(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          if (onBlur) onBlur(e);
        }}
        onKeyUp={(e) => {
          syncScroll();
          checkAutocomplete();
          if (onKeyUp) onKeyUp(e);
        }}
        onKeyDown={handleKeyDown}
        onSelect={(e) => {
          syncScroll();
          checkAutocomplete();
          if (onSelect) onSelect(e);
        }}
        onMouseUp={checkAutocomplete}
        onDoubleClick={onDoubleClick}
        onMouseMove={hasVariables ? handleInputMouseMove : undefined}
        onMouseLeave={() => {
          if (!isPinnedRef.current && !isHoveringPopoverRef.current) scheduleClose();
        }}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          outline: "none",
          color: hasVariables ? "transparent" : "inherit",
          caretColor: "var(--color-text)",
          boxSizing: "border-box",
          position: "relative",
          zIndex: 2,
          paddingRight: isPasswordProp ? "28px" : undefined,
          ...style,
        }}
        className={className}
        {...rest}
        type={actualType}
      />

      {isPasswordProp && (
        <button
          type="button"
          onClick={() => setShowPassword((p) => !p)}
          tabIndex={-1}
          style={{
            position: "absolute",
            right: "8px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "transparent",
            border: "none",
            color: "var(--color-text-dim)",
            cursor: "pointer",
            zIndex: 3,
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title={showPassword ? "Hide value" : "Show value"}
        >
          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      )}

      {/* Popover Card */}
      {activeTooltip && (
        <VariablePopoverCard
          tooltipKey={activeTooltip.key}
          tooltipValue={activeTooltip.value}
          isResolved={activeTooltip.isResolved}
          x={activeTooltip.x}
          y={activeTooltip.y}
          placement={activeTooltip.placement}
          activeEnvironmentName={activeEnvironmentName}
          onSaveVariable={onSaveVariable}
          onClose={closePopoverImmediately}
          onMouseEnter={() => {
            cancelCloseTimer();
            isHoveringPopoverRef.current = true;
          }}
          onMouseLeave={() => {
            isHoveringPopoverRef.current = false;
            scheduleClose();
          }}
          onInputFocus={() => {
            cancelCloseTimer();
            isPinnedRef.current = true;
          }}
        />
      )}

      {/* Custom Suggestions Dropdown */}
      {suggestions && suggestions.length > 0 && isFocused && suggestionState.open !== false && filteredSuggestions.length > 0 && (
        <div
          className="input-suggestions-dropdown"
          onMouseDown={(e) => e.preventDefault()}
        >
          {filteredSuggestions.map((item, index) => {
            const isSelected = index === (suggestionState.selectedIndex || 0);
            return (
              <button
                key={item}
                type="button"
                className={`input-suggestion-item ${isSelected ? "selected" : ""}`}
                onClick={() => handleApplySuggestion(item)}
                onMouseEnter={() => setSuggestionState({ open: true, selectedIndex: index })}
              >
                <span className="input-suggestion-badge">
                  {suggestionBadge || "OPT"}
                </span>
                <span className="input-suggestion-text">{item}</span>
                {isSelected && <Check size={12} className="input-suggestion-check" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export interface VariableTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  activeVariables: EnvironmentVariable[];
  activeEnvironmentName?: string;
  onSaveVariable?: (envName: string, key: string, value: string) => Promise<void> | void;
  containerStyle?: React.CSSProperties;
  containerClassName?: string;
}

export function VariableTextarea({
  activeVariables,
  activeEnvironmentName,
  onSaveVariable,
  value = "",
  onChange,
  onScroll,
  onFocus,
  onBlur,
  onKeyUp,
  onKeyDown,
  onSelect,
  onDoubleClick,
  style,
  className,
  containerStyle,
  containerClassName,
  ...rest
}: VariableTextareaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const isHoveringPopoverRef = useRef(false);
  const isPinnedRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isFocused, setIsFocused] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<TooltipState | null>(null);

  const strValue = String(value);
  const hasVariables = /\{\{[^{}]+\}\}/.test(strValue);

  const [autocomplete, setAutocomplete] = useState<{
    prefix: string;
    options: EnvironmentVariable[];
    selectedIndex: number;
    startOffset: number;
  } | null>(null);

  const cancelCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    if (isPinnedRef.current || isHoveringPopoverRef.current) return;
    cancelCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      if (!isPinnedRef.current && !isHoveringPopoverRef.current) {
        setActiveTooltip(null);
      }
    }, 300);
  }, [cancelCloseTimer]);

  const closePopoverImmediately = useCallback(() => {
    cancelCloseTimer();
    isPinnedRef.current = false;
    isHoveringPopoverRef.current = false;
    setActiveTooltip(null);
  }, [cancelCloseTimer]);

  useEffect(() => {
    if (!activeTooltip) return;

    function handlePointerDownOutside(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closePopoverImmediately();
      }
    }

    window.addEventListener("pointerdown", handlePointerDownOutside);
    return () => window.removeEventListener("pointerdown", handlePointerDownOutside);
  }, [activeTooltip, closePopoverImmediately]);

  const checkAutocomplete = () => {
    const el = textareaRef.current;
    if (!el) return;
    const val = el.value;
    const cursor = el.selectionStart ?? 0;
    const beforeCursor = val.slice(0, cursor);
    const match = beforeCursor.match(/\{\{([^{}]*)$/);
    if (match) {
      const prefix = match[1].toLowerCase();
      const options = activeVariables.filter((v) => v.key.toLowerCase().includes(prefix));
      if (options.length > 0) {
        setAutocomplete((prev) => ({
          prefix,
          options,
          selectedIndex: prev ? Math.min(prev.selectedIndex, options.length - 1) : 0,
          startOffset: match.index!,
        }));
        return;
      }
    }
    setAutocomplete(null);
  };

  const applyAutocomplete = (variable: EnvironmentVariable) => {
    if (!autocomplete) return;
    const el = textareaRef.current;
    if (!el) return;
    const val = strValue;
    const start = autocomplete.startOffset;
    const cursor = el.selectionStart ?? start + 2;
    const newVal = val.slice(0, start) + "{{" + variable.key + "}}" + val.slice(cursor);

    if (onChange) {
      const syntheticEvent = { target: { value: newVal } } as any;
      onChange(syntheticEvent);
    }
    setAutocomplete(null);
    setTimeout(() => {
      const currentEl = textareaRef.current;
      if (currentEl) {
        const newCursor = start + 4 + variable.key.length;
        currentEl.setSelectionRange(newCursor, newCursor);
        currentEl.focus();
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (autocomplete) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAutocomplete((prev) => (prev ? { ...prev, selectedIndex: (prev.selectedIndex + 1) % prev.options.length } : null));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setAutocomplete((prev) => (prev ? { ...prev, selectedIndex: (prev.selectedIndex - 1 + prev.options.length) % prev.options.length } : null));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        applyAutocomplete(autocomplete.options[autocomplete.selectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setAutocomplete(null);
        return;
      }
    }
    if (onKeyDown) onKeyDown(e);
  };

  const showTooltipForSpan = useCallback(
    (span: Element) => {
      const varName = (span as HTMLElement).dataset.varname;
      if (!varName) return;

      const variable = activeVariables.find((v) => v.key === varName);
      const isResolved = !!variable;
      const val = isResolved ? variable!.value : "";

      const parentRect = containerRef.current!.getBoundingClientRect();
      const spanRect = span.getBoundingClientRect();

      const spaceAbove = spanRect.top;
      const placement: "top" | "bottom" = spaceAbove < 180 ? "bottom" : "top";

      const y = placement === "top"
        ? spanRect.top - 6
        : spanRect.bottom + 6;

      setActiveTooltip({
        key: varName,
        value: val,
        isSecret: false,
        isResolved,
        x: spanRect.left + spanRect.width / 2,
        y,
        placement,
      });
    },
    [activeVariables]
  );

  const lastMoveTimeRef = useRef(0);
  const handleTextareaMouseMove = useCallback(
    (e: React.MouseEvent<HTMLTextAreaElement>) => {
      const now = Date.now();
      if (now - lastMoveTimeRef.current < 30) return;
      lastMoveTimeRef.current = now;

      if (isPinnedRef.current || isHoveringPopoverRef.current) return;

      const textarea = textareaRef.current;
      if (!textarea) return;

      textarea.style.pointerEvents = "none";
      const elemBelow = document.elementFromPoint(e.clientX, e.clientY);
      textarea.style.pointerEvents = "";

      if (elemBelow && elemBelow.classList.contains("variable-highlight") && elemBelow.classList.contains("resolved")) {
        cancelCloseTimer();
        const varName = (elemBelow as HTMLElement).dataset.varname;
        if (activeTooltip?.key === varName) return; // already showing
        showTooltipForSpan(elemBelow);
      } else {
        scheduleClose();
      }
    },
    [showTooltipForSpan, cancelCloseTimer, scheduleClose, activeTooltip]
  );

  const renderHighlightedText = () => {
    if (!strValue) return null;
    const parts = strValue.split(VARIABLE_PATTERN);

    return parts.map((part, index) => {
      const isVar = part.startsWith("{{") && part.endsWith("}}");
      if (isVar) {
        const varName = part.slice(2, -2).trim();
        const exists = activeVariables.some((v) => v.key === varName);
        const isActivePopover = activeTooltip?.key === varName;
        const spanClassName = exists
          ? `variable-highlight resolved ${isActivePopover ? "active-popover" : ""}`
          : `variable-highlight unresolved ${isActivePopover ? "active-popover" : ""}`;

        return (
          <span key={index} className={spanClassName} data-varname={varName}>
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div
      ref={containerRef}
      className={`variable-input-container ${isFocused ? "focused" : ""} ${containerClassName || ""}`}
      style={{
        position: "relative",
        display: "inline-flex",
        width: "100%",
        boxSizing: "border-box",
        ...containerStyle,
      }}
    >
      <div
        ref={backdropRef}
        className="variable-input-backdrop"
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "block",
          pointerEvents: "none",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflow: "hidden",
          boxSizing: "border-box",
          backgroundColor: "transparent",
        }}
      >
        {renderHighlightedText()}
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        spellCheck={false}
        onChange={(e) => {
          if (onChange) onChange(e);
          if (!isPinnedRef.current) closePopoverImmediately();
          setTimeout(() => checkAutocomplete(), 0);
        }}
        onScroll={(e) => {
          if (onScroll) onScroll(e);
          if (!isPinnedRef.current) closePopoverImmediately();
        }}
        onFocus={(e) => {
          setIsFocused(true);
          if (onFocus) onFocus(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          if (onBlur) onBlur(e);
        }}
        onKeyUp={(e) => {
          checkAutocomplete();
          if (onKeyUp) onKeyUp(e);
        }}
        onKeyDown={handleKeyDown}
        onSelect={(e) => {
          checkAutocomplete();
          if (onSelect) onSelect(e);
        }}
        onMouseUp={checkAutocomplete}
        onDoubleClick={onDoubleClick}
        onMouseMove={hasVariables ? handleTextareaMouseMove : undefined}
        onMouseLeave={() => {
          if (!isPinnedRef.current && !isHoveringPopoverRef.current) scheduleClose();
        }}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          outline: "none",
          color: "transparent",
          caretColor: "var(--color-text)",
          boxSizing: "border-box",
          position: "relative",
          zIndex: 2,
          resize: "none",
          ...style,
        }}
        className={className}
        {...rest}
      />

      {/* Popover Card */}
      {activeTooltip && (
        <VariablePopoverCard
          tooltipKey={activeTooltip.key}
          tooltipValue={activeTooltip.value}
          isResolved={activeTooltip.isResolved}
          x={activeTooltip.x}
          y={activeTooltip.y}
          placement={activeTooltip.placement}
          activeEnvironmentName={activeEnvironmentName}
          onSaveVariable={onSaveVariable}
          onClose={closePopoverImmediately}
          onMouseEnter={() => {
            cancelCloseTimer();
            isHoveringPopoverRef.current = true;
          }}
          onMouseLeave={() => {
            isHoveringPopoverRef.current = false;
            scheduleClose();
          }}
          onInputFocus={() => {
            cancelCloseTimer();
            isPinnedRef.current = true;
          }}
        />
      )}
    </div>
  );
}
