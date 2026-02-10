import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useTranslation, Trans } from "react-i18next";
import { CLAUDE_MODELS } from "@mapthew/shared/constants";
import type { ClaudeModel } from "@mapthew/shared/types";
import { api } from "../api/client";
import { Dropdown } from "../components/Dropdown";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorCard } from "../components/ErrorCard";
import { SaveButton } from "../components/SaveButton";
import { IntegrationsCard } from "../components/IntegrationsCard";
import { useConfig } from "../context/ConfigContext";

const BOT_NAME_REGEX = /^[a-z0-9][a-z0-9_-]*$/;

function validateBotName(value: string): string | null {
  if (!value) {
    return "Bot name is required";
  }
  if (value.length < 2) {
    return "Bot name must be at least 2 characters";
  }
  if (value.length > 32) {
    return "Bot name must be 32 characters or less";
  }
  if (!/^[a-z0-9]/.test(value)) {
    return "Bot name must start with a letter or number";
  }
  if (!BOT_NAME_REGEX.test(value)) {
    return "Bot name can only contain lowercase letters, numbers, dashes, and underscores";
  }
  return null;
}

function validateJiraBaseUrl(value: string): string | null {
  if (!value) return null; // Empty is allowed
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      return "settings.integrations.jira.baseUrlInvalid";
    }
    return null;
  } catch {
    return "settings.integrations.jira.baseUrlInvalid";
  }
}

export default function Settings() {
  const { t } = useTranslation();
  const { botDisplayName } = useConfig();
  const queryClient = useQueryClient();
  const [botName, setBotName] = useState("");
  const [claudeModel, setClaudeModel] = useState<ClaudeModel | "">(CLAUDE_MODELS[0]);
  const [jiraBaseUrl, setJiraBaseUrl] = useState("");
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: config, isLoading, error } = useQuery({
    queryKey: ["config"],
    queryFn: api.getConfig,
  });

  const { data: secrets } = useQuery({
    queryKey: ["secrets"],
    queryFn: api.getSecrets,
  });

  useEffect(() => {
    if (config) {
      setBotName(config.botName);
      setClaudeModel(config.claudeModel);
      setJiraBaseUrl(config.jiraBaseUrl);
    }
  }, [config]);

  const mutation = useMutation({
    mutationFn: (updates: { botName: string; claudeModel: ClaudeModel; jiraBaseUrl: string }) =>
      api.updateConfig(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const validationError = validateBotName(botName);
  const showError = touched && validationError;
  const jiraBaseUrlError = validateJiraBaseUrl(jiraBaseUrl);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow valid characters, auto-lowercase
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    setBotName(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!validationError && !jiraBaseUrlError && claudeModel) {
      mutation.mutate({ botName, claudeModel, jiraBaseUrl });
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorCard message={t("settings.errorLoading", { message: (error as Error).message })} />;
  }

  const hasChanges =
    botName !== config?.botName ||
    claudeModel !== config?.claudeModel ||
    jiraBaseUrl !== config?.jiraBaseUrl;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-white flex items-center gap-3">
        <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
        {t("settings.title")}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass-card p-6 space-y-6">
          <div>
            <label htmlFor="botName" className="block text-sm font-medium text-dark-200">
              {t("settings.botName.label")}
            </label>
            <p className="text-sm text-dark-500 mt-1 mb-3">
              <Trans
                i18nKey="settings.botName.description"
                values={{ botName: botName || "mapthew" }}
                components={{
                  name: <code className="px-1.5 py-0.5 bg-dark-800 rounded text-accent" />
                }}
              />
            </p>
            <div className={`flex items-center bg-dark-950/50 border rounded-lg transition-all focus-within:ring-2 focus-within:border-transparent ${
              showError
                ? "border-red-500/50 focus-within:ring-red-500/50"
                : "border-dark-700 focus-within:ring-accent"
            }`}>
              <span className="pl-4 text-dark-400 text-lg select-none">@</span>
              <input
                type="text"
                id="botName"
                value={botName}
                onChange={handleChange}
                onBlur={() => setTouched(true)}
                maxLength={32}
                autoComplete="off"
                className="flex-1 px-2 py-3 bg-transparent text-white placeholder-dark-500 focus:outline-none"
                placeholder={t("settings.botName.placeholder")}
              />
            </div>
            {showError && (
              <p className="text-sm text-red-400 mt-3">{validationError}</p>
            )}
            <p className="text-sm text-dark-600 mt-3 italic">
              {t("settings.botName.tip")}
            </p>
          </div>

          <hr className="border-dark-700" />

          <div>
            <label htmlFor="claudeModel" className="block text-sm font-medium text-dark-200">
              {t("settings.claudeModel.label")}
            </label>
            <p className="text-sm text-dark-500 mt-1 mb-3">
              {t("settings.claudeModel.description")}
            </p>
            <Dropdown
              id="claudeModel"
              value={claudeModel}
              options={CLAUDE_MODELS.map((model) => ({ value: model, label: model }))}
              onChange={(value) => setClaudeModel(value as ClaudeModel)}
            />
          </div>
        </div>

        {secrets && (
          <IntegrationsCard
            secrets={secrets}
            jiraBaseUrl={jiraBaseUrl}
            onJiraBaseUrlChange={setJiraBaseUrl}
            jiraBaseUrlError={jiraBaseUrlError ? t(jiraBaseUrlError) : null}
          />
        )}

        <div className="flex items-center justify-center gap-4">
          <SaveButton
            isPending={mutation.isPending}
            isSaved={saved}
            disabled={mutation.isPending || (!hasChanges && !saved) || !!validationError || !!jiraBaseUrlError}
            label={t("common.save")}
          />
          {mutation.error && (
            <span className="text-red-400 text-sm">
              {(mutation.error as Error).message}
            </span>
          )}
        </div>
        </form>

      <div className="text-center pt-8">
        <p className="text-dark-600 text-sm">
          {t("settings.version", { version: __APP_VERSION__ })}
        </p>
      </div>
    </div>
  );
}
