import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface MenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  minWidth?: number;
}

export function Menu({ trigger, children, align = "left", minWidth = 200 }: MenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getMenuStyle = (): React.CSSProperties => {
    if (!triggerRef.current) return {};
    const rect = triggerRef.current.getBoundingClientRect();
    return {
      position: "fixed",
      top: rect.bottom + 8,
      minWidth,
      ...(align === "right"
        ? { right: window.innerWidth - rect.right }
        : { left: rect.left }),
    };
  };

  return (
    <>
      <div ref={triggerRef} onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>
      {isOpen && createPortal(
        <div
          ref={menuRef}
          style={getMenuStyle()}
          className="z-50 bg-dark-900 border border-dark-700 rounded-lg shadow-xl overflow-hidden"
        >
          {children}
        </div>,
        document.body
      )}
    </>
  );
}
