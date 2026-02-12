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

/** Format a size in MB, auto-converting to GB when >= 1024 MB */
function formatSize(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

function StatCard({ label, value, accent, loading }: { label: string; value: string | number; accent?: boolean; loading?: boolean }) {
  return (
    <div className="glass-card p-4 text-center">
      {loading ? (
        <p className="text-2xl font-bold text-dark-400 animate-pulse">...</p>
      ) : (
        <p className={`text-2xl font-bold ${accent ? "text-accent" : "text-white"}`}>{value}</p>
      )}
      <p className="text-dark-400 text-sm mt-1">{label}</p>
    </div>
  );
}

/** Inline loading placeholder for size cells */
function SizeCell({ value, loading }: { value?: number; loading: boolean }) {
  if (loading) {
    return <span className="text-dark-500 animate-pulse">--</span>;
  }
  return <>{formatSize(value ?? 0)}</>;
}

function SessionRow({
  session,
  sizeMB,
  workspaceSizeMB,
  sizesLoading,
}: {
  session: {
    issueKey: string;
    lastUsed: string;
    createdAt: string;
  };
  sizeMB?: number;
  workspaceSizeMB?: number;
  sizesLoading: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteSession(session.issueKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["sessionSizes"] });
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
      <td className="py-4 px-4 text-sm text-dark-400">
        <SizeCell value={sizeMB} loading={sizesLoading} />
      </td>
      <td className="py-4 px-4 text-sm text-dark-400">
        <SizeCell value={workspaceSizeMB} loading={sizesLoading} />
      </td>
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

  // Fast query: session list without sizes
  const { data, isLoading, error } = useQuery({
    queryKey: ["sessions"],
    queryFn: api.getSessions,
    refetchInterval: 10_000,
  });

  // Slow query: sizes loaded separately
  const { data: sizesData, isLoading: sizesLoading } = useQuery({
    queryKey: ["sessionSizes"],
    queryFn: api.getSessionSizes,
    refetchInterval: 30_000, // Less frequent since it's expensive
  });

  if (isLoading) return <LoadingSpinner />;

  if (error) {
    return <ErrorCard message={t("sessions.errorLoading", { message: (error as Error).message })} />;
  }

  const sessions = data?.sessions.filter((s) => s.hasSession) ?? [];

  // Build a lookup map from sizes data
  const sizeMap = new Map<string, { sizeMB: number; workspaceSizeMB: number }>();
  if (sizesData) {
    for (const s of sizesData.sizes) {
      sizeMap.set(s.issueKey, { sizeMB: s.sizeMB, workspaceSizeMB: s.workspaceSizeMB });
    }
  }

  const activeKeys = new Set(sessions.map((s) => s.issueKey));
  const activeSizes = sizesData
    ? sizesData.sizes.filter((s) => activeKeys.has(s.issueKey))
    : [];
  const totalSessionSizeMB = activeSizes.reduce((sum, s) => sum + s.sizeMB, 0);
  const totalWorkspaceSizeMB = activeSizes.reduce((sum, s) => sum + s.workspaceSizeMB, 0);
  const totalCombinedSizeMB = activeSizes.reduce((sum, s) => sum + s.sizeMB + s.workspaceSizeMB, 0);

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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label={t("sessions.stats.active")} value={`${data.count} / ${data.softCap}`} accent />
          <StatCard label={t("sessions.stats.available")} value={data.available} />
          <StatCard label={t("sessions.stats.pruneThreshold")} value={`${data.pruneThresholdDays}d`} />
          <StatCard label={t("sessions.stats.totalSessionSize")} value={formatSize(totalSessionSizeMB)} loading={sizesLoading} />
          <StatCard label={t("sessions.stats.totalWorkspaceSize")} value={formatSize(totalWorkspaceSizeMB)} loading={sizesLoading} />
          <StatCard label={t("sessions.stats.totalSize")} value={formatSize(totalCombinedSizeMB)} accent loading={sizesLoading} />
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
                  {t("sessions.table.sessionSize")}
                </th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">
                  {t("sessions.table.workspaceSize")}
                </th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">
                  {t("sessions.table.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => {
                const sizes = sizeMap.get(session.issueKey);
                return (
                  <SessionRow
                    key={session.issueKey}
                    session={session}
                    sizeMB={sizes?.sizeMB}
                    workspaceSizeMB={sizes?.workspaceSizeMB}
                    sizesLoading={sizesLoading}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
