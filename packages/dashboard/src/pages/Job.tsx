import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { parseJobData } from "@mapthew/shared/utils";
import { api } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorCard } from "../components/ErrorCard";
import { JiraBadge } from "../components/JiraBadge";
import { GitHubBadge } from "../components/GitHubBadge";

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

  const { data: config } = useQuery({
    queryKey: ["config"],
    queryFn: api.getConfig,
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
      navigate("/tasks");
    },
  });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorCard message={t("task.errorLoading", { message: (error as Error).message })} />;
  }

  if (!job) {
    return (
      <div className="glass-card p-6">
        <p className="text-dark-400">{t("task.notFound")}</p>
      </div>
    );
  }

  const createdAt = new Date(job.timestamp).toLocaleString();
  const processedAt = job.processedOn ? new Date(job.processedOn).toLocaleString() : "-";
  const finishedAt = job.finishedOn ? new Date(job.finishedOn).toLocaleString() : "-";

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const queueTime = job.processedOn ? formatDuration(job.processedOn - job.timestamp) : null;
  const processTime = job.processedOn && job.finishedOn ? formatDuration(job.finishedOn - job.processedOn) : null;
  
  const jobData = parseJobData(job.data);
  
  const instruction = typeof jobData.instruction === "string" ? jobData.instruction : null;
  
  // Extract JIRA issue key from job data
  const jiraIssueKey = typeof jobData.issueKey === "string" 
    ? jobData.issueKey 
    : typeof jobData.jiraIssueKey === "string" 
    ? jobData.jiraIssueKey 
    : null;
  
  const jiraUrl = jiraIssueKey && config?.jiraBaseUrl 
    ? `${config.jiraBaseUrl.replace(/\/$/, '')}/browse/${jiraIssueKey}`
    : null;
  
  // Extract GitHub info from job data
  const githubOwner = typeof jobData.owner === "string" 
    ? jobData.owner 
    : typeof jobData.githubOwner === "string" 
    ? jobData.githubOwner 
    : null;
  
  const githubRepo = typeof jobData.repo === "string" 
    ? jobData.repo 
    : typeof jobData.githubRepo === "string" 
    ? jobData.githubRepo 
    : null;
  
  const githubPrNumber = typeof jobData.prNumber === "number" 
    ? jobData.prNumber 
    : typeof jobData.githubPrNumber === "number" 
    ? jobData.githubPrNumber 
    : null;
  
  const githubIssueNumber = typeof jobData.issueNumber === "number" 
    ? jobData.issueNumber 
    : typeof jobData.githubIssueNumber === "number" 
    ? jobData.githubIssueNumber 
    : null;
  
  const githubPrUrl = githubOwner && githubRepo && githubPrNumber
    ? `https://github.com/${githubOwner}/${githubRepo}/pull/${githubPrNumber}`
    : null;
  
  const githubIssueUrl = githubOwner && githubRepo && githubIssueNumber
    ? `https://github.com/${githubOwner}/${githubRepo}/issues/${githubIssueNumber}`
    : null;

  return (
    <div className="space-y-6">
      <Link to="/tasks" className="inline-flex items-center gap-2 text-dark-400 hover:text-white transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t("task.backToTasks")}
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
              {t("task.retryTask")}
            </button>
          )}
          <button
            onClick={() => removeMutation.mutate()}
            disabled={removeMutation.isPending}
            className="btn-danger disabled:opacity-50"
          >
            {t("task.removeTask")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wider mb-1">{t("task.created")}</p>
          <p className="text-white font-medium">{createdAt}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wider mb-1">{t("task.processed")}</p>
          <p className="text-white font-medium">{processedAt}</p>
          {queueTime && <p className="text-dark-400 text-sm mt-1">{t("task.timeInQueue")}: {queueTime}</p>}
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wider mb-1">{t("task.finished")}</p>
          <p className="text-white font-medium">{finishedAt}</p>
          {processTime && <p className="text-dark-400 text-sm mt-1">{t("task.processingTime")}: {processTime}</p>}
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wider mb-1">{t("task.attempts")}</p>
          <p className="text-white font-medium">{job.attemptsMade}</p>
        </div>
      </div>

      {instruction && (
        <div className="glass-card p-6 border-accent/40 bg-accent/5">
          <h2 className="text-xs font-medium text-dark-400 uppercase tracking-wider mb-3">{t("task.instruction")}</h2>
          <p className="text-white leading-relaxed mb-4">{instruction}</p>
          {(jiraUrl || githubPrUrl || githubIssueUrl) && (
            <div className="flex items-center gap-2">
              {jiraUrl && jiraIssueKey && (
                <JiraBadge url={jiraUrl} label={jiraIssueKey} />
              )}
              {githubPrUrl && githubPrNumber && (
                <GitHubBadge url={githubPrUrl} label={`#${githubPrNumber}`} />
              )}
              {githubIssueUrl && githubIssueNumber && (
                <GitHubBadge url={githubIssueUrl} label={`#${githubIssueNumber}`} />
              )}
            </div>
          )}
        </div>
      )}

      {job.failedReason && job.status === "failed" && (
        <div className="glass-card p-6 border-red-500/30 bg-red-500/5">
          <h2 className="text-lg font-semibold text-red-400 mb-3">{t("task.error")}</h2>
          <pre className="text-red-300 text-sm whitespace-pre-wrap font-mono">{job.failedReason}</pre>
        </div>
      )}

      {job.failedReason && job.status === "completed" && (
        <div className="glass-card p-6 border-yellow-500/30 bg-yellow-500/5">
          <h2 className="text-lg font-semibold text-yellow-400 mb-3">{t("task.previousError")}</h2>
          <p className="text-dark-300 text-sm mb-3">{t("task.retriedSuccessfully")}</p>
          <pre className="text-yellow-300/80 text-sm whitespace-pre-wrap font-mono">{job.failedReason}</pre>
        </div>
      )}

      <div className="glass-card p-6 space-y-6">
        <div>
          <h2 className="text-sm font-medium text-dark-200 mb-3">{t("task.taskData")}</h2>
          <pre className="bg-dark-950/50 p-4 rounded-lg overflow-auto text-sm font-mono text-dark-200 border border-dark-700/50">
            {JSON.stringify(jobData, null, 2)}
          </pre>
        </div>
        {job.returnvalue && (
          <div>
            <h2 className="text-sm font-medium text-dark-200 mb-3">{t("task.returnValue")}</h2>
            <pre className="bg-dark-950/50 p-4 rounded-lg overflow-auto text-sm font-mono text-dark-200 border border-dark-700/50">
              {job.returnvalue}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
