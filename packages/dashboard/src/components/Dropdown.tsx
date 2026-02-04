import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  id?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export function Dropdown({ id, value, options, onChange, placeholder }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getMenuStyle = (): React.CSSProperties => {
    if (!buttonRef.current) return {};
    const rect = buttonRef.current.getBoundingClientRect();
    
    // Get viewport dimensions
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // Calculate available space
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    // Estimate menu height based on options
    const estimatedMenuHeight = Math.min(options.length * 48 + 8, 400);
    
    // Determine vertical position
    let bottom: number | undefined;
    let top: number | undefined;
    let maxHeight: number;
    
    if (spaceBelow >= estimatedMenuHeight || spaceBelow >= spaceAbove) {
      // Open below - set top position
      top = rect.bottom + 4;
      maxHeight = Math.max(100, spaceBelow - 8);
    } else {
      // Open above - align bottom to top of button
      bottom = viewportHeight - rect.top + 4;
      maxHeight = Math.max(100, spaceAbove - 8);
    }
    
    // Determine horizontal position
    let left = rect.left;
    const menuWidth = rect.width;
    
    // Check if menu extends beyond right edge
    if (left + menuWidth > viewportWidth - 8) {
      left = Math.max(8, viewportWidth - menuWidth - 8);
    }
    
    // Check if menu extends beyond left edge
    if (left < 8) {
      left = 8;
    }
    
    const style: React.CSSProperties = {
      position: "fixed",
      left: `${left}px`,
      width: `${rect.width}px`,
      maxHeight: `${maxHeight}px`,
      overflowY: "auto",
    };
    
    if (top !== undefined) {
      style.top = `${top}px`;
    } else if (bottom !== undefined) {
      style.bottom = `${bottom}px`;
    }
    
    return style;
  };

  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption?.label || value || placeholder || "";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        id={id}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 bg-dark-900 border rounded-lg text-white text-left flex items-center justify-between transition-all ${
          isOpen
            ? "border-accent ring-2 ring-accent"
            : "border-dark-700 hover:border-dark-600"
        }`}
      >
        <span>{displayValue}</span>
        <svg
          className={`w-5 h-5 text-dark-400 transition-transform mr-1 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && createPortal(
        <div
          ref={menuRef}
          style={getMenuStyle()}
          className="z-50 bg-dark-900 border border-dark-700 rounded-lg shadow-xl"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-3 text-left transition-colors ${
                option.value === value
                  ? "bg-accent/20 text-white"
                  : "text-dark-200 hover:bg-dark-800 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
