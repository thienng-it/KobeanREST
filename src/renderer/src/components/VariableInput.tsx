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

  const strValue = String(value);

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
      const isSecret = !!variable?.secret;
      const val = isResolved
        ? isSecret
          ? "•••••••• (encrypted secret)"
          : variable!.value
        : "";

      const parentRect = containerRef.current!.getBoundingClientRect();
      const spanRect = span.getBoundingClientRect();

      setActiveTooltip({
        key: varName,
        value: val,
        isSecret,
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
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: "none",
          whiteSpace: "pre",
          overflow: "hidden",
          boxSizing: "border-box",
          backgroundColor: "transparent",
          border: "1px solid transparent",
          display: "flex",
          alignItems: "center",
        }}
      >
        {renderHighlightedText()}
      </div>

      {/* Input */}
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          if (onChange) onChange(e);
          setActiveTooltip(null);
          // Small defer to let React state update before syncing scroll
          setTimeout(syncScroll, 0);
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
          if (onKeyUp) onKeyUp(e);
        }}
        onKeyDown={(e) => {
          syncScroll();
          if (onKeyDown) onKeyDown(e);
        }}
        onSelect={(e) => {
          syncScroll();
          if (onSelect) onSelect(e);
        }}
        onMouseMove={handleInputMouseMove}
        onMouseLeave={handleInputMouseLeave}
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
      const isSecret = !!variable?.secret;
      const val = isResolved
        ? isSecret
          ? "•••••••• (encrypted secret)"
          : variable!.value
        : "";

      const parentRect = containerRef.current!.getBoundingClientRect();
      const spanRect = span.getBoundingClientRect();

      setActiveTooltip({
        key: varName,
        value: val,
        isSecret,
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
        onChange={(e) => {
          if (onChange) onChange(e);
          setActiveTooltip(null);
          setTimeout(syncScroll, 0);
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
          if (onKeyUp) onKeyUp(e);
        }}
        onKeyDown={(e) => {
          syncScroll();
          if (onKeyDown) onKeyDown(e);
        }}
        onSelect={(e) => {
          syncScroll();
          if (onSelect) onSelect(e);
        }}
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
    </div>
  );
}
