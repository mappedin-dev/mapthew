import { useState, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: string;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({ x: rect.left + rect.width / 2, y: rect.top - 8 });
    setShow(true);
  }, []);

  return (
    <>
      <span
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShow(false)}
      >
        {children}
      </span>
      {show && createPortal(
        <div
          className="fixed z-50 px-2 py-1 text-xs text-white bg-dark-900 border border-dark-700 rounded shadow-lg whitespace-nowrap -translate-x-1/2 -translate-y-full pointer-events-none"
          style={{ left: position.x, top: position.y }}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  );
}
