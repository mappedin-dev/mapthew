import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

export interface SearchResult {
  id: string;
  label: string;
}

interface SearchableCheckboxProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  value: SearchResult | null;
  onValueChange: (value: SearchResult | null) => void;
  onSearch: (query: string) => Promise<SearchResult[]>;
  placeholder?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function SearchableCheckbox({
  label,
  checked,
  onCheckedChange,
  value,
  onValueChange,
  onSearch,
  placeholder,
  disabled = false,
  disabledReason,
}: SearchableCheckboxProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const isFocusedRef = useRef(false);

  // Update menu position
  const updateMenuPosition = useCallback(() => {
    if (!inputWrapperRef.current) return;
    const rect = inputWrapperRef.current.getBoundingClientRect();
    
    // Get viewport dimensions
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const estimatedMenuHeight = 200;
    
    let style: React.CSSProperties = {
      position: "fixed",
      left: rect.left,
      width: rect.width,
    };
    
    if (spaceBelow >= estimatedMenuHeight || spaceBelow >= spaceAbove) {
      // Open below
      style.top = rect.bottom + 4;
      style.maxHeight = `${Math.max(100, spaceBelow - 8)}px`;
    } else {
      // Open above - align bottom to top of input
      style.bottom = viewportHeight - rect.top + 4;
      style.maxHeight = `${Math.max(100, spaceAbove - 8)}px`;
    }
    
    setMenuStyle(style);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!checked || disabled) return;

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const searchResults = await onSearch(query);
        setResults(searchResults);
        setError(null);
        // Auto-open dropdown when results are available (for pre-population)
        if (searchResults.length > 0 && !value) {
          updateMenuPosition();
          setIsOpen(true);
        }
      } catch (err) {
        console.error("Search error:", err);
        const errorMessage = err instanceof Error ? err.message : "Search failed";
        setError(errorMessage);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, checked, disabled, onSearch, value, updateMenuPosition]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newChecked = e.target.checked;
      onCheckedChange(newChecked);
      if (!newChecked) {
        onValueChange(null);
        setQuery("");
        setResults([]);
      }
    },
    [onCheckedChange, onValueChange]
  );

  const handleInputFocus = useCallback(() => {
    isFocusedRef.current = true;
    updateMenuPosition();
    setIsOpen(true);
  }, [updateMenuPosition]);

  const handleInputBlur = useCallback(() => {
    isFocusedRef.current = false;
  }, []);

  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      onValueChange(result);
      setQuery(result.label);
      setIsOpen(false);
    },
    [onValueChange]
  );

  const handleClear = useCallback(() => {
    onValueChange(null);
    setQuery("");
    inputRef.current?.focus();
  }, [onValueChange]);

  // Hide dropdown during scroll, reopen when scroll ends
  useEffect(() => {
    if (!isOpen && !isFocusedRef.current) return;

    let scrollTimeout: ReturnType<typeof setTimeout>;
    let isScrolling = false;

    const handleScroll = (event: Event) => {
      // Allow scrolling within the dropdown menu itself
      if (menuRef.current && menuRef.current.contains(event.target as Node)) {
        return;
      }
      
      if (!isScrolling && isOpen) {
        setIsOpen(false);
      }
      isScrolling = true;

      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isScrolling = false;
        // Reopen if input is still focused
        if (isFocusedRef.current) {
          updateMenuPosition();
          setIsOpen(true);
        }
      }, 150);
    };

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", updateMenuPosition);

    return () => {
      clearTimeout(scrollTimeout);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", updateMenuPosition);
    };
  }, [isOpen, updateMenuPosition]);

  const isEffectivelyDisabled = disabled || !checked;

  return (
    <div ref={containerRef} className="space-y-2">
      {/* Checkbox row */}
      <label className="flex items-center gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={checked}
          onChange={handleCheckboxChange}
          disabled={disabled}
          className="w-4 h-4 rounded border-dark-600 bg-dark-900 text-accent focus:ring-accent focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <span
          className={`text-sm font-medium ${
            disabled ? "text-dark-500" : "text-dark-200 group-hover:text-white"
          }`}
        >
          {label}
        </span>
        {disabled && disabledReason && (
          <span className="text-xs text-dark-500">({disabledReason})</span>
        )}
      </label>

      {/* Search input - only visible when checked */}
      {checked && (
        <div ref={inputWrapperRef} className="ml-7">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={value ? value.label : query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (value) onValueChange(null);
              }}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              placeholder={placeholder || t("newTask.searchPlaceholder")}
              disabled={disabled}
              className={`w-full px-3 py-2 bg-dark-900 border rounded-lg text-sm text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all ${
                isOpen
                  ? "border-accent"
                  : "border-dark-700 hover:border-dark-600"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            />
            {/* Loading indicator */}
            {isLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-dark-500 border-t-accent rounded-full animate-spin" />
              </div>
            )}
            {/* Clear button */}
            {value && !isLoading && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Dropdown menu */}
          {isOpen &&
            !isEffectivelyDisabled &&
            createPortal(
              <div
                ref={menuRef}
                style={menuStyle}
                className="z-50 bg-dark-900 border border-dark-700 rounded-lg shadow-xl overflow-auto"
              >
                {results.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-dark-400">
                    {isLoading
                      ? t("common.loading")
                      : query
                        ? "No results found"
                        : "Type to search..."}
                  </div>
                ) : (
                  results.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => handleSelectResult(result)}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                        value?.id === result.id
                          ? "bg-accent/20 text-white"
                          : "text-dark-200 hover:bg-dark-800 hover:text-white"
                      }`}
                    >
                      {result.label}
                    </button>
                  ))
                )}
              </div>,
              document.body
            )}
        </div>
      )}
    </div>
  );
}
