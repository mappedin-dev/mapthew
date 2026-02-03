import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, type JobData } from "../api/client";

const STATUS_OPTIONS = ["all", "waiting", "active", "completed", "failed", "delayed"] as const;

function StatusBadge({ status }: { status: JobData["status"] }) {
  const styles: Record<JobData["status"], string> = {
    waiting: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    active: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    failed: "bg-red-500/20 text-red-400 border-red-500/30",
    delayed: "bg-dark-600/50 text-dark-300 border-dark-500/30",
  };

  const { t } = useTranslation();

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
      {t(`jobs.status.${status}`)}
    </span>
  );
}

function JobRow({ job }: { job: JobData }) {
  const { t } = useTranslation();
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

  const time = new Date(job.timestamp).toLocaleString();
  const source = (job.data as { source?: string }).source ?? "unknown";

  return (
    <tr className="border-b border-dark-700/50 hover:bg-dark-800/50 transition-colors">
      <td className="py-4 px-4">
        <Link to={`/jobs/${job.id}`} className="text-accent hover:text-accent-hover font-mono text-sm transition-colors">
          {job.id}
        </Link>
      </td>
      <td className="py-4 px-4">
        <StatusBadge status={job.status} />
      </td>
      <td className="py-4 px-4 text-sm text-dark-300 capitalize">{source}</td>
      <td className="py-4 px-4 text-sm text-dark-400">{time}</td>
      <td className="py-4 px-4">
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
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">{t("jobs.title")}</h1>
        <p className="text-dark-400">{t("jobs.description")}</p>
      </div>

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
            {t(`jobs.status.${s}`)}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="glass-card p-6 border-red-500/30">
          <p className="text-red-400">{t("jobs.errorLoading", { message: (error as Error).message })}</p>
        </div>
      )}

      {jobs && jobs.length === 0 && (
        <div className="glass-card p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-dark-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-dark-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-dark-400">{t("jobs.noJobs")}</p>
        </div>
      )}

      {jobs && jobs.length > 0 && (
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-700/50">
                <th className="text-left py-4 px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">{t("jobs.table.id")}</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">{t("jobs.table.status")}</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">{t("jobs.table.source")}</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">{t("jobs.table.created")}</th>
                <th className="text-left py-4 px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">{t("jobs.table.actions")}</th>
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
