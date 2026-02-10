import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorCard } from "../components/ErrorCard";
import { EmptyState } from "../components/EmptyState";

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDays}d ago`;
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="glass-card p-4 text-center">
      <p className={`text-2xl font-bold ${accent ? "text-accent" : "text-white"}`}>{value}</p>
      <p className="text-dark-400 text-sm mt-1">{label}</p>
    </div>
  );
}

function SessionRow({
  session,
}: {
  session: {
    issueKey: string;
    lastUsed: string;
    createdAt: string;
    sizeMB: number;
  };
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteSession(session.issueKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });

  const handleDelete = () => {
    if (window.confirm(t("sessions.deleteConfirm", { issueKey: session.issueKey }))) {
      deleteMutation.mutate();
    }
  };

  return (
    <tr className="border-b border-dark-700/50 hover:bg-dark-800/50 transition-colors">
      <td className="py-4 px-4">
        <span className="text-accent font-mono text-sm">{session.issueKey}</span>
      </td>
      <td className="py-4 px-4 text-sm text-dark-300">{formatTimeAgo(session.lastUsed)}</td>
      <td className="py-4 px-4 text-sm text-dark-400">
        {new Date(session.createdAt).toLocaleDateString()}
      </td>
      <td className="py-4 px-4 text-sm text-dark-400">{session.sizeMB} MB</td>
      <td className="py-4 px-4">
        <button
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="text-xs px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 disabled:opacity-50 transition-colors border border-red-500/30"
        >
          {t("sessions.delete")}
        </button>
      </td>
    </tr>
  );
}

export default function Sessions() {
  const { t } = useTranslation();

  const { data, isLoading, error } = useQuery({
    queryKey: ["sessions"],
    queryFn: api.getSessions,
    refetchInterval: 10_000,
  });

  if (isLoading) return <LoadingSpinner />;

  if (error) {
    return <ErrorCard message={t("sessions.errorLoading", { message: (error as Error).message })} />;
  }

  const sessions = data?.sessions.filter((s) => s.hasSession) ?? [];
  const utilizationPercent = data ? Math.round((data.count / data.max) * 100) : 0;
  const totalSizeMB =
    sessions.reduce((sum, s) => sum + s.sizeMB, 0).toFixed(1);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white flex items-center gap-3">
        <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
        {t("sessions.title")}
      </h1>

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label={t("sessions.stats.active")} value={`${data.count} / ${data.max}`} accent />
          <StatCard label={t("sessions.stats.available")} value={data.available} />
          <StatCard label={t("sessions.stats.utilization")} value={`${utilizationPercent}%`} />
          <StatCard label={t("sessions.stats.totalSize")} value={`${totalSizeMB} MB`} />
        </div>
      )}

      {sessions.length === 0 && <EmptyState message={t("sessions.noSessions")} />}

      {sessions.length > 0 && (
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-700/50">
                <th className="text-left py-4 px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">
                  {t("sessions.table.issueKey")}
                </th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">
                  {t("sessions.table.lastUsed")}
                </th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">
                  {t("sessions.table.created")}
                </th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">
                  {t("sessions.table.size")}
                </th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">
                  {t("sessions.table.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <SessionRow key={session.issueKey} session={session} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
