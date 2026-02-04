import { ReactNode } from "react";

interface BadgeProps {
  href: string;
  bgColor: string;
  hoverBgColor: string;
  icon: ReactNode;
  label: string;
}

export function Badge({ href, bgColor, hoverBgColor, icon, label }: BadgeProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg transition-all shadow-sm hover:shadow-md"
      style={{
        backgroundColor: bgColor,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = hoverBgColor;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = bgColor;
      }}
    >
      {icon}
      <span className="text-sm font-medium text-white">{label}</span>
    </a>
  );
}
