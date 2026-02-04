import { useTranslation } from "react-i18next";
import type { JobData } from "../api/client";

interface StatusBadgeProps {
  status: JobData["status"];
  size?: "sm" | "md";
}

const styles: Record<JobData["status"], string> = {
  waiting: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  active: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  delayed: "bg-dark-600/50 text-dark-300 border-dark-500/30",
};

const sizeStyles = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
};

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const { t } = useTranslation();

  return (
    <span className={`rounded-full font-medium border ${styles[status]} ${sizeStyles[size]}`}>
      {t(`tasks.status.${status}`)}
    </span>
  );
}
