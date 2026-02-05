import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { JobData } from "@mapthew/shared/api-types";
import { parseJobData } from "@mapthew/shared/utils";
import { api } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorCard } from "../components/ErrorCard";
import { EmptyState } from "../components/EmptyState";

const STATUS_OPTIONS = ["all", "waiting", "active", "completed", "failed", "delayed"] as const;

function JobRow({ job }: { job: JobData }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const retryMutation = useMutation({
    mutationFn: () => api.retryJob(job.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["queue-stats"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => api.removeJob(job.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["queue-stats"] });
    },
  });

  const createdAt = new Date(job.timestamp).toLocaleString();
  const finishedAt = job.finishedOn ? new Date(job.finishedOn).toLocaleString() : "-";
  const parsedData = parseJobData(job.data);
  const source = (parsedData.source as string) ?? "unknown";

  const handleRowClick = () => {
    navigate(`/tasks/${job.id}`);
  };

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <tr
      onClick={handleRowClick}
      className="border-b border-dark-700/50 hover:bg-dark-800/50 transition-colors cursor-pointer"
    >
      <td className="py-4 px-4">
        <span className="text-accent font-mono text-sm">{job.id}</span>
      </td>
      <td className="py-4 px-4">
        <StatusBadge status={job.status} size="sm" />
      </td>
      <td className="py-4 px-4 text-sm text-dark-300 capitalize">{source}</td>
      <td className="py-4 px-4 text-sm text-dark-400">{createdAt}</td>
      <td className="py-4 px-4 text-sm text-dark-400">{finishedAt}</td>
      <td className="py-4 px-4" onClick={handleActionClick}>
        <div className="flex gap-2">
          {job.status === "failed" && (
            <button
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
              className="text-xs px-3 py-1.5 bg-accent/20 text-accent rounded-lg hover:bg-accent/30 disabled:opacity-50 transition-colors border border-accent/30"
            >
              {t("common.retry")}
            </button>
          )}
          <button
            onClick={() => removeMutation.mutate()}
            disabled={removeMutation.isPending}
            className="text-xs px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 disabled:opacity-50 transition-colors border border-red-500/30"
          >
            {t("common.remove")}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function Jobs() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get("status") ?? "all";

  const { data: jobs, isLoading, error } = useQuery({
    queryKey: ["jobs", status],
    queryFn: () => api.getJobs(status === "all" ? undefined : status),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white flex items-center gap-3">
        <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        {t("tasks.title")}
      </h1>

      <div className="flex gap-2 flex-wrap">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setSearchParams(s === "all" ? {} : { status: s })}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              status === s
                ? "bg-accent text-white shadow-lg shadow-accent/25"
                : "bg-dark-800 text-dark-300 hover:text-white hover:bg-dark-700 border border-dark-700"
            }`}
          >
            {t(`tasks.status.${s}`)}
          </button>
        ))}
      </div>

      {isLoading && <LoadingSpinner />}

      {error && <ErrorCard message={t("tasks.errorLoading", { message: (error as Error).message })} />}

      {jobs && jobs.length === 0 && <EmptyState message={t("tasks.noTasks")} />}

      {jobs && jobs.length > 0 && (
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-700/50">
                <th className="text-left py-4 px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">{t("tasks.table.id")}</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">{t("tasks.table.status")}</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">{t("tasks.table.source")}</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">{t("tasks.table.created")}</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">{t("tasks.table.finished")}</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">{t("tasks.table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
