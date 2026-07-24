import React, { useRef, useEffect, useState, useCallback } from "react";
import { EnvironmentVariable } from "../types";

const VARIABLE_PATTERN = /(\{\{[^{}]+\}\})/g;

interface TooltipState {
  key: string;
  value: string;
  isSecret: boolean;
  isResolved: boolean;
  x: number;
  y: number;
}

interface VariableInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  activeVariables: EnvironmentVariable[];
  containerStyle?: React.CSSProperties;
  containerClassName?: string;
}

export function VariableInput({
  activeVariables,
  value = "",
  onChange,
  onScroll,
  onFocus,
  onBlur,
  onKeyUp,
  onKeyDown,
  onSelect,
  style,
  className,
  containerStyle,
  containerClassName,
  ...rest
}: VariableInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const [isFocused, setIsFocused] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<TooltipState | null>(null);

  const [autocomplete, setAutocomplete] = useState<{
    prefix: string;
    options: EnvironmentVariable[];
    selectedIndex: number;
    startOffset: number;
  } | null>(null);

  const strValue = String(value);
  const hasVariables = /\{\{[^{}]+\}\}/.test(strValue);

  const checkAutocomplete = () => {
    const el = inputRef.current || (backdropRef.current?.parentElement?.querySelector('textarea') as HTMLTextAreaElement);
    if (!el) return;
    const val = el.value;
    const cursor = el.selectionStart ?? 0;
    const beforeCursor = val.slice(0, cursor);
    const match = beforeCursor.match(/\{\{([^{}]*)$/);
    if (match) {
      const prefix = match[1].toLowerCase();
      const options = activeVariables.filter((v) => v.key.toLowerCase().includes(prefix));
      if (options.length > 0) {
        setAutocomplete(prev => ({
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
    const el = inputRef.current || (backdropRef.current?.parentElement?.querySelector('textarea') as HTMLTextAreaElement);
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
      const currentEl = inputRef.current || (backdropRef.current?.parentElement?.querySelector('textarea') as HTMLTextAreaElement);
      if (currentEl) {
        const newCursor = start + 4 + variable.key.length;
        currentEl.setSelectionRange(newCursor, newCursor);
        currentEl.focus();
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (autocomplete) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocomplete(prev => prev ? { ...prev, selectedIndex: (prev.selectedIndex + 1) % prev.options.length } : null);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocomplete(prev => prev ? { ...prev, selectedIndex: (prev.selectedIndex - 1 + prev.options.length) % prev.options.length } : null);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applyAutocomplete(autocomplete.options[autocomplete.selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAutocomplete(null);
        return;
      }
    }
    syncScroll();
    if (onKeyDown) onKeyDown(e as any);
  };

  // Sync scroll position
  const syncScroll = () => {
    if (inputRef.current && backdropRef.current) {
      backdropRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  };

  // Sync styles from input to backdrop
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

  // Sync on mount and window resize
  useEffect(() => {
    syncStyles();
    window.addEventListener("resize", syncStyles);
    return () => window.removeEventListener("resize", syncStyles);
  }, []);

  /**
   * Show tooltip for a given variable span element and mouse position.
   */
  const showTooltipForSpan = useCallback(
    (span: Element, clientX: number, clientY: number) => {
      const varName = (span as HTMLElement).dataset.varname;
      if (!varName) return;

      const variable = activeVariables.find((v) => v.key === varName);
      const isResolved = !!variable;
      const val = isResolved ? variable!.value : "";

      const parentRect = containerRef.current!.getBoundingClientRect();
      const spanRect = span.getBoundingClientRect();

      setActiveTooltip({
        key: varName,
        value: val,
        isSecret: false,
        isResolved,
        x: spanRect.left - parentRect.left + spanRect.width / 2,
        y: spanRect.top - parentRect.top - 8,
      });
    },
    [activeVariables]
  );

  /**
   * Handle mousemove on the input: temporarily hide the input's pointer-events
   * so elementFromPoint can reach the backdrop span underneath.
   */
  const handleInputMouseMove = useCallback(
    (e: React.MouseEvent<HTMLInputElement>) => {
      const input = inputRef.current;
      if (!input) return;

      // Temporarily disable pointer-events on the input so we can hit-test beneath it
      input.style.pointerEvents = "none";
      const elemBelow = document.elementFromPoint(e.clientX, e.clientY);
      input.style.pointerEvents = "";

      if (elemBelow && elemBelow.classList.contains("variable-highlight")) {
        showTooltipForSpan(elemBelow, e.clientX, e.clientY);
      } else {
        setActiveTooltip(null);
      }
    },
    [showTooltipForSpan]
  );

  const handleInputMouseLeave = useCallback(() => {
    setActiveTooltip(null);
  }, []);

  const renderHighlightedText = () => {
    if (!strValue) return null;
    const parts = strValue.split(VARIABLE_PATTERN);

    return parts.map((part, index) => {
      const isVar = part.startsWith("{{") && part.endsWith("}}");
      if (isVar) {
        const varName = part.slice(2, -2).trim();
        const exists = activeVariables.some((v) => v.key === varName);
        const spanClassName = exists
          ? "variable-highlight resolved"
          : "variable-highlight unresolved";

        return (
          <span
            key={index}
            className={spanClassName}
            data-varname={varName}
          >
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
          setActiveTooltip(null);
          // Small defer to let React state update before syncing scroll
          setTimeout(() => {
            syncScroll();
            checkAutocomplete();
          }, 0);
        }}
        onScroll={(e) => {
          syncScroll();
          if (onScroll) onScroll(e);
          setActiveTooltip(null);
        }}
        onFocus={(e) => {
          setIsFocused(true);
          if (onFocus) onFocus(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          if (onBlur) onBlur(e);
          setActiveTooltip(null);
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
        onMouseMove={hasVariables ? handleInputMouseMove : undefined}
        onMouseLeave={hasVariables ? handleInputMouseLeave : undefined}
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
          ...style,
        }}
        className={className}
        {...rest}
      />

      {/* Tooltip */}
      {activeTooltip && (
        <div
          className="variable-tooltip"
          style={{
            left: `${activeTooltip.x}px`,
            top: `${activeTooltip.y}px`,
            transform: "translate(-50%, -100%)",
          }}
        >
          {activeTooltip.isResolved ? (
            <div style={{ opacity: 0.9, fontFamily: "monospace", fontSize: "11px" }}>
              {activeTooltip.value}
            </div>
          ) : (
            <div style={{ color: "#f87171", fontWeight: 500 }}>
              Unresolved variable (not in active environment)
            </div>
          )}
          <div className="variable-tooltip-arrow" />
        </div>
      )}
    </div>
  );
}

interface VariableTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  activeVariables: EnvironmentVariable[];
  containerStyle?: React.CSSProperties;
  containerClassName?: string;
}

export function VariableTextarea({
  activeVariables,
  value = "",
  onChange,
  onScroll,
  onFocus,
  onBlur,
  onKeyUp,
  onKeyDown,
  onSelect,
  style,
  className,
  containerStyle,
  containerClassName,
  ...rest
}: VariableTextareaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const [isFocused, setIsFocused] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<TooltipState | null>(null);

  const strValue = String(value);

  const [autocomplete, setAutocomplete] = useState<{
    prefix: string;
    options: EnvironmentVariable[];
    selectedIndex: number;
    startOffset: number;
  } | null>(null);

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
        setAutocomplete(prev => ({
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (autocomplete) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocomplete(prev => prev ? { ...prev, selectedIndex: (prev.selectedIndex + 1) % prev.options.length } : null);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocomplete(prev => prev ? { ...prev, selectedIndex: (prev.selectedIndex - 1 + prev.options.length) % prev.options.length } : null);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applyAutocomplete(autocomplete.options[autocomplete.selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAutocomplete(null);
        return;
      }
    }
    syncScroll();
    if (onKeyDown) onKeyDown(e as any);
  };

  // Sync scroll position
  const syncScroll = () => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  // Sync styles from textarea to backdrop
  const syncStyles = () => {
    if (textareaRef.current && backdropRef.current) {
      const textareaStyle = window.getComputedStyle(textareaRef.current);
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
        "wordBreak",
        "overflowWrap",
      ];

      stylesToSync.forEach((prop) => {
        // @ts-ignore
        backdrop.style[prop] = textareaStyle[prop];
      });
    }
  };

  useEffect(() => {
    syncStyles();
    syncScroll();
  }, [strValue, isFocused]);

  // Sync on mount and window resize
  useEffect(() => {
    syncStyles();
    window.addEventListener("resize", syncStyles);
    return () => window.removeEventListener("resize", syncStyles);
  }, []);

  /**
   * Show tooltip for a given variable span element.
   */
  const showTooltipForSpan = useCallback(
    (span: Element) => {
      const varName = (span as HTMLElement).dataset.varname;
      if (!varName) return;

      const variable = activeVariables.find((v) => v.key === varName);
      const isResolved = !!variable;
      const val = isResolved ? variable!.value : "";

      const parentRect = containerRef.current!.getBoundingClientRect();
      const spanRect = span.getBoundingClientRect();

      setActiveTooltip({
        key: varName,
        value: val,
        isSecret: false,
        isResolved,
        x: spanRect.left - parentRect.left + spanRect.width / 2,
        y: spanRect.top - parentRect.top - 8,
      });
    },
    [activeVariables]
  );

  /**
   * Handle mousemove on the textarea: temporarily disable pointer-events on
   * the textarea so elementFromPoint can reach the backdrop span underneath.
   */
  const handleTextareaMouseMove = useCallback(
    (e: React.MouseEvent<HTMLTextAreaElement>) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      textarea.style.pointerEvents = "none";
      const elemBelow = document.elementFromPoint(e.clientX, e.clientY);
      textarea.style.pointerEvents = "";

      if (elemBelow && elemBelow.classList.contains("variable-highlight")) {
        showTooltipForSpan(elemBelow);
      } else {
        setActiveTooltip(null);
      }
    },
    [showTooltipForSpan]
  );

  const handleTextareaMouseLeave = useCallback(() => {
    setActiveTooltip(null);
  }, []);

  const renderHighlightedText = () => {
    if (!strValue) return null;
    const parts = strValue.split(VARIABLE_PATTERN);

    return parts.map((part, index) => {
      const isVar = part.startsWith("{{") && part.endsWith("}}");
      if (isVar) {
        const varName = part.slice(2, -2).trim();
        const exists = activeVariables.some((v) => v.key === varName);
        const spanClassName = exists
          ? "variable-highlight resolved"
          : "variable-highlight unresolved";

        return (
          <span
            key={index}
            className={spanClassName}
            data-varname={varName}
          >
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
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: "none",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          overflow: "hidden",
          boxSizing: "border-box",
          backgroundColor: "transparent",
          border: "1px solid transparent",
        }}
      >
        {renderHighlightedText()}
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        onChange={(e) => {
          if (onChange) onChange(e);
          setActiveTooltip(null);
          setTimeout(() => {
            syncScroll();
            checkAutocomplete();
          }, 0);
        }}
        onScroll={(e) => {
          syncScroll();
          if (onScroll) onScroll(e);
          setActiveTooltip(null);
        }}
        onFocus={(e) => {
          setIsFocused(true);
          if (onFocus) onFocus(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          if (onBlur) onBlur(e);
          setActiveTooltip(null);
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
        onMouseMove={handleTextareaMouseMove}
        onMouseLeave={handleTextareaMouseLeave}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          outline: "none",
          color: strValue ? "transparent" : "inherit",
          caretColor: "var(--color-text)",
          boxSizing: "border-box",
          position: "relative",
          zIndex: 2,
          ...style,
        }}
        className={className}
        {...rest}
      />

      {/* Tooltip */}
      {activeTooltip && (
        <div
          className="variable-tooltip"
          style={{
            left: `${activeTooltip.x}px`,
            top: `${activeTooltip.y}px`,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "2px" }}>
            {"{{"} {activeTooltip.key} {"}}"}
          </div>
          {activeTooltip.isResolved ? (
            <div style={{ opacity: 0.9, fontFamily: "monospace", fontSize: "11px" }}>
              Value: {activeTooltip.value}
            </div>
          ) : (
            <div style={{ color: "#f87171", fontWeight: 500 }}>
              Unresolved variable (not in active environment)
            </div>
          )}
          <div className="variable-tooltip-arrow" />
        </div>
      )}

      {/* Autocomplete Menu */}
      {autocomplete && (
        <div
          className="variable-autocomplete-menu"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 10,
            background: 'var(--color-panel)',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            maxHeight: '200px',
            overflowY: 'auto',
            minWidth: '200px',
            marginTop: '4px',
          }}
        >
          {autocomplete.options.map((opt, idx) => (
            <div
              key={opt.key}
              onClick={() => applyAutocomplete(opt)}
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
                background: idx === autocomplete.selectedIndex ? 'var(--color-surface-hover)' : 'transparent',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '8px',
              }}
              onMouseEnter={() => setAutocomplete(prev => prev ? { ...prev, selectedIndex: idx } : null)}
            >
              <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{opt.key}</span>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{opt.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
