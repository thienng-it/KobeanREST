import { useState, useRef, useEffect, type ReactNode, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

export interface CustomSelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "",
  ariaLabel,
  disabled = false
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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
        className="custom-select-trigger"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={handleToggle}
      >
        <span className="custom-select-label">
          {selectedOption?.icon && <span className="custom-select-icon">{selectedOption.icon}</span>}
          <span>{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <ChevronDown size={14} className="custom-select-caret" />
      </button>

      {isOpen &&
        createPortal(
          <div className="custom-select-dropdown" style={dropdownStyle}>
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`custom-select-option ${isSelected ? "selected" : ""}`}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                >
                  <span className="custom-select-option-label">
                    {opt.icon && <span className="custom-select-icon">{opt.icon}</span>}
                    <span>{opt.label}</span>
                  </span>
                  {isSelected && <Check size={14} className="custom-select-check" />}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
