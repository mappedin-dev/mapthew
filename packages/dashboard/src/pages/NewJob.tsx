import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { AdminJobContext, GitHubRepoResult } from "@mapthew/shared/api-types";
import { api } from "../api/client";
import {
  SearchableCheckbox,
  type SearchResult,
} from "../components/SearchableCheckbox";

export default function NewJob() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [instruction, setInstruction] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // JIRA context state
  const [jiraBoardEnabled, setJiraBoardEnabled] = useState(false);
  const [jiraBoard, setJiraBoard] = useState<SearchResult | null>(null);
  const [jiraTicketEnabled, setJiraTicketEnabled] = useState(false);
  const [jiraTicket, setJiraTicket] = useState<SearchResult | null>(null);

  // GitHub context state
  const [githubRepoEnabled, setGithubRepoEnabled] = useState(false);
  const [githubRepo, setGithubRepo] = useState<{
    owner: string;
    repo: string;
    label: string;
  } | null>(null);
  const [githubBranchEnabled, setGithubBranchEnabled] = useState(false);
  const [githubBranch, setGithubBranch] = useState<SearchResult | null>(null);
  const [githubPrEnabled, setGithubPrEnabled] = useState(false);
  const [githubPr, setGithubPr] = useState<SearchResult | null>(null);
  const [githubIssueEnabled, setGithubIssueEnabled] = useState(false);
  const [githubIssue, setGithubIssue] = useState<SearchResult | null>(null);

  // Handle board checkbox change
  const handleJiraBoardEnabledChange = useCallback((checked: boolean) => {
    setJiraBoardEnabled(checked);
    if (!checked) {
      setJiraBoard(null);
      setJiraTicket(null);
      setJiraTicketEnabled(false);
    }
  }, []);

  // Handle board value change
  const handleJiraBoardChange = useCallback((value: SearchResult | null) => {
    setJiraBoard(value);
    if (!value) {
      // Clear dependent ticket when board is cleared
      setJiraTicket(null);
      setJiraTicketEnabled(false);
    }
  }, []);

  // Search handlers
  const searchJiraBoards = useCallback(
    (query: string) => api.searchJiraBoards(query),
    []
  );

  const searchJiraIssues = useCallback(
    (query: string) => {
      if (!jiraBoard) return Promise.resolve([]);
      return api.searchJiraIssues(query, jiraBoard.id);
    },
    [jiraBoard]
  );

  const searchGithubRepos = useCallback(async (query: string) => {
    const results = await api.searchGitHubRepos(query);
    // Transform to SearchResult format for the component
    return results.map((r: GitHubRepoResult) => ({
      id: `${r.owner}/${r.repo}`,
      label: r.label,
      // Store extra data in the id for extraction later
    }));
  }, []);

  const searchGithubBranches = useCallback(
    (query: string) => {
      if (!githubRepo) return Promise.resolve([]);
      return api.searchGitHubBranches(githubRepo.owner, githubRepo.repo, query);
    },
    [githubRepo]
  );

  const searchGithubPulls = useCallback(
    (query: string) => {
      if (!githubRepo) return Promise.resolve([]);
      return api.searchGitHubPulls(githubRepo.owner, githubRepo.repo, query);
    },
    [githubRepo]
  );

  const searchGithubIssues = useCallback(
    (query: string) => {
      if (!githubRepo) return Promise.resolve([]);
      return api.searchGitHubIssues(githubRepo.owner, githubRepo.repo, query);
    },
    [githubRepo]
  );

  // Handle repo selection (extract owner/repo from combined id)
  const handleGithubRepoChange = useCallback(
    (value: SearchResult | null) => {
      if (value) {
        const [owner, repo] = value.id.split("/");
        setGithubRepo({ owner, repo, label: value.label });
      } else {
        setGithubRepo(null);
        // Clear dependent fields when repo is cleared
        setGithubBranch(null);
        setGithubPr(null);
        setGithubIssue(null);
        setGithubBranchEnabled(false);
        setGithubPrEnabled(false);
        setGithubIssueEnabled(false);
      }
    },
    []
  );

  // Handle repo checkbox change
  const handleGithubRepoEnabledChange = useCallback((checked: boolean) => {
    setGithubRepoEnabled(checked);
    if (!checked) {
      setGithubRepo(null);
      setGithubBranch(null);
      setGithubPr(null);
      setGithubIssue(null);
      setGithubBranchEnabled(false);
      setGithubPrEnabled(false);
      setGithubIssueEnabled(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instruction.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    // Build context object
    const context: AdminJobContext = {};
    if (jiraBoardEnabled && jiraBoard) {
      context.jiraBoardId = jiraBoard.id;
    }
    if (jiraTicketEnabled && jiraTicket) {
      context.jiraIssueKey = jiraTicket.id;
    }
    if (githubRepoEnabled && githubRepo) {
      context.githubOwner = githubRepo.owner;
      context.githubRepo = githubRepo.repo;
    }
    if (githubBranchEnabled && githubBranch) {
      context.githubBranchId = githubBranch.id;
    }
    if (githubPrEnabled && githubPr) {
      context.githubPrNumber = parseInt(githubPr.id, 10);
    }
    if (githubIssueEnabled && githubIssue) {
      context.githubIssueNumber = parseInt(githubIssue.id, 10);
    }

    try {
      const result = await api.createJob(
        instruction.trim(),
        Object.keys(context).length > 0 ? context : undefined
      );
      navigate(`/tasks/${result.jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-white flex items-center gap-3">
        <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
        {t("newTask.title")}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass-card p-6 space-y-6">
          {/* Instruction */}
          <div>
            <label
              htmlFor="instruction"
              className="block text-sm font-medium text-dark-200 mb-2"
            >
              {t("newTask.instructionLabel")}
            </label>
            <p className="text-sm text-dark-500 mb-3">
              {t("newTask.instructionDescription")}
            </p>
            <textarea
              id="instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={t("newTask.instructionPlaceholder")}
              rows={8}
              className="w-full px-4 py-3 bg-dark-950/50 border border-dark-700 rounded-lg text-white placeholder-dark-600 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none transition-all"
              disabled={isSubmitting}
            />
          </div>

          {/* Context Options */}
          <div>
            <h2 className="text-sm font-medium text-dark-200 mb-2">
              {t("newTask.contextOptions")}
            </h2>
            <p className="text-sm text-dark-500 mb-4">
              {t("newTask.contextDescription")}
            </p>

            <div className="space-y-4">
              {/* JIRA Section */}
              <div className="space-y-3">
                <SearchableCheckbox
                  label={t("newTask.jiraBoard")}
                  checked={jiraBoardEnabled}
                  onCheckedChange={handleJiraBoardEnabledChange}
                  value={jiraBoard}
                  onValueChange={handleJiraBoardChange}
                  onSearch={searchJiraBoards}
                  disabled={isSubmitting}
                />
                <SearchableCheckbox
                  label={t("newTask.jiraTicket")}
                  checked={jiraTicketEnabled}
                  onCheckedChange={setJiraTicketEnabled}
                  value={jiraTicket}
                  onValueChange={setJiraTicket}
                  onSearch={searchJiraIssues}
                  disabled={isSubmitting || !jiraBoard}
                />
              </div>

              {/* Divider */}
              <div className="border-t border-dark-700" />

              {/* GitHub Section */}
              <div className="space-y-3">
                <SearchableCheckbox
                  label={t("newTask.githubRepo")}
                  checked={githubRepoEnabled}
                  onCheckedChange={handleGithubRepoEnabledChange}
                  value={
                    githubRepo
                      ? { id: `${githubRepo.owner}/${githubRepo.repo}`, label: githubRepo.label }
                      : null
                  }
                  onValueChange={handleGithubRepoChange}
                  onSearch={searchGithubRepos}
                  disabled={isSubmitting}
                />
                <SearchableCheckbox
                  label={t("newTask.githubBranch")}
                  checked={githubBranchEnabled}
                  onCheckedChange={setGithubBranchEnabled}
                  value={githubBranch}
                  onValueChange={setGithubBranch}
                  onSearch={searchGithubBranches}
                  disabled={isSubmitting || !githubRepo}
                />
                <SearchableCheckbox
                  label={t("newTask.githubPr")}
                  checked={githubPrEnabled}
                  onCheckedChange={setGithubPrEnabled}
                  value={githubPr}
                  onValueChange={setGithubPr}
                  onSearch={searchGithubPulls}
                  disabled={isSubmitting || !githubRepo}
                />
                <SearchableCheckbox
                  label={t("newTask.githubIssue")}
                  checked={githubIssueEnabled}
                  onCheckedChange={setGithubIssueEnabled}
                  value={githubIssue}
                  onValueChange={setGithubIssue}
                  onSearch={searchGithubIssues}
                  disabled={isSubmitting || !githubRepo}
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="glass-card p-4 border-red-500/30 bg-red-500/5">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="flex justify-center">
          <button
            type="submit"
            disabled={!instruction.trim() || isSubmitting}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t("newTask.starting")}
              </span>
            ) : (
              t("newTask.start")
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
