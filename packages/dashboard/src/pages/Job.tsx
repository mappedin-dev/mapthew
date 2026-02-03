import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, type JobData } from "../api/client";

function StatusBadge({ status }: { status: JobData["status"] }) {
  const { t } = useTranslation();
  const styles: Record<JobData["status"], string> = {
    waiting: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    active: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    failed: "bg-red-500/20 text-red-400 border-red-500/30",
    delayed: "bg-dark-600/50 text-dark-300 border-dark-500/30",
  };

  return (
    <span className={`px-3 py-1.5 rounded-full text-sm font-medium border ${styles[status]}`}>
      {t(`jobs.status.${status}`)}
    </span>
  );
}

function DataSection({ title, data }: { title: string; data: unknown }) {
  return (
    <div className="glass-card p-6">
      <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
      <pre className="bg-dark-950/50 p-4 rounded-lg overflow-auto text-sm font-mono text-dark-200 border border-dark-700/50">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export default function Job() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: job, isLoading, error } = useQuery({
    queryKey: ["job", id],
    queryFn: () => api.getJob(id!),
    enabled: !!id,
  });

  const retryMutation = useMutation({
    mutationFn: () => api.retryJob(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", id] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["queue-stats"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => api.removeJob(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["queue-stats"] });
      navigate("/jobs");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-6 border-red-500/30">
        <p className="text-red-400">{t("job.errorLoading", { message: (error as Error).message })}</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="glass-card p-6">
        <p className="text-dark-400">{t("job.notFound")}</p>
      </div>
    );
  }

  const createdAt = new Date(job.timestamp).toLocaleString();
  const processedAt = job.processedOn ? new Date(job.processedOn).toLocaleString() : "-";
  const finishedAt = job.finishedOn ? new Date(job.finishedOn).toLocaleString() : "-";

  return (
    <div className="space-y-6">
      <Link to="/jobs" className="inline-flex items-center gap-2 text-dark-400 hover:text-white transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t("job.backToJobs")}
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white font-mono">{job.id}</h1>
          <StatusBadge status={job.status} />
        </div>
        <div className="flex gap-3">
          {job.status === "failed" && (
            <button
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
              className="btn-primary disabled:opacity-50"
            >
              {t("job.retryJob")}
            </button>
          )}
          <button
            onClick={() => removeMutation.mutate()}
            disabled={removeMutation.isPending}
            className="btn-danger disabled:opacity-50"
          >
            {t("job.removeJob")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wider mb-1">{t("job.created")}</p>
          <p className="text-white font-medium">{createdAt}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wider mb-1">{t("job.processed")}</p>
          <p className="text-white font-medium">{processedAt}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wider mb-1">{t("job.finished")}</p>
          <p className="text-white font-medium">{finishedAt}</p>
        </div>
      </div>

      {job.failedReason && (
        <div className="glass-card p-6 border-red-500/30 bg-red-500/5">
          <h2 className="text-lg font-semibold text-red-400 mb-3">{t("job.error")}</h2>
          <pre className="text-red-300 text-sm whitespace-pre-wrap font-mono">{job.failedReason}</pre>
        </div>
      )}

      <div className="space-y-6">
        <DataSection title={t("job.jobData")} data={job.data} />
        {job.returnvalue !== undefined && <DataSection title={t("job.returnValue")} data={job.returnvalue} />}
      </div>
    </div>
  );
}
