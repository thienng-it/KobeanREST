import { useState, useRef, useEffect, type ReactNode, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

export interface CustomSelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
  color?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
  variant?: "default" | "ghost";
  searchable?: boolean;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "",
  ariaLabel,
  disabled = false,
  variant = "default",
  searchable = false
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownCoords({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    }
  };

  const handleToggle = () => {
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const targetNode = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(targetNode) &&
        !(targetNode as Element)?.closest?.(".custom-select-dropdown")
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    function handleScrollOrResize() {
      if (isOpen) {
        updatePosition();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
      window.addEventListener("scroll", handleScrollOrResize, true);
      window.addEventListener("resize", handleScrollOrResize);
    }
    
    if (isOpen && searchable && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen]);

  const dropdownStyle: CSSProperties = dropdownCoords
    ? {
        position: "fixed",
        top: `${dropdownCoords.top}px`,
        left: `${Math.max(12, Math.min(dropdownCoords.left, window.innerWidth - 240))}px`,
        minWidth: `${Math.max(dropdownCoords.width, 160)}px`,
        maxWidth: "340px",
        zIndex: 999999
      }
    : {};

  return (
    <div className={`custom-select-container ${isOpen ? "open" : ""} ${className}`} ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className={variant === "ghost" ? "ghost-button custom-select-trigger-ghost" : "custom-select-trigger"}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={handleToggle}
      >
        <span className="custom-select-label">
          {selectedOption ? (
            <>
              {selectedOption.color && (
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: selectedOption.color, marginRight: '6px', flexShrink: 0 }} />
              )}
              {selectedOption.icon && <span className="custom-select-icon">{selectedOption.icon}</span>}
              <span>{selectedOption.label}</span>
            </>
          ) : (
            <span className="custom-select-placeholder">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={14} className="custom-select-caret" />
      </button>

      {isOpen &&
        createPortal(
          <div className="custom-select-dropdown" style={dropdownStyle}>
            {searchable && (
              <div style={{ padding: "8px", borderBottom: "1px solid var(--color-border)" }}>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: "4px",
                    border: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-bg)",
                    color: "var(--color-text)",
                    fontSize: "12px",
                    outline: "none"
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
            <div className="custom-select-options-list">
            {options.filter(opt => !searchQuery || opt.label.toLowerCase().includes(searchQuery.toLowerCase())).map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`custom-select-option ${isSelected ? "selected" : ""}`}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearchQuery("");
                  }}
                >
                  <span className="custom-select-option-label">
                    {opt.color && (
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: opt.color, marginRight: '6px', flexShrink: 0 }} />
                    )}
                    {opt.icon && <span className="custom-select-icon">{opt.icon}</span>}
                    <span>{opt.label}</span>
                  </span>
                  {isSelected && <Check size={14} className="custom-select-check" />}
                </button>
              );
            })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
