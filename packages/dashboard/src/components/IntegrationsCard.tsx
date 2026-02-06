import { useTranslation } from "react-i18next";
import type { SecretsStatus } from "@mapthew/shared/api-types";
import { JiraLogo } from "./JiraLogo";
import { GitHubLogo } from "./GitHubLogo";
import { FigmaLogo } from "./FigmaLogo";
import { Tooltip } from "./Tooltip";

interface IntegrationsCardProps {
  secrets: SecretsStatus;
  jiraBaseUrl: string;
  onJiraBaseUrlChange: (value: string) => void;
  jiraBaseUrlError?: string | null;
}

function LockIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 text-dark-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  );
}

function SecretField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const { t } = useTranslation();
  const isEmpty = !value;

  return (
    <div className="flex items-center gap-4 py-1">
      <span className="text-sm text-dark-400 shrink-0 w-28">{label}</span>
      <span className={`flex-1 text-sm font-mono ${value.includes("*") ? "tracking-wider" : ""} ${isEmpty ? "text-dark-600 italic" : "text-dark-300"}`}>
        {isEmpty ? t("settings.integrations.notConfigured") : value}
      </span>
      {!isEmpty && (
        <Tooltip content={t("settings.integrations.notEditable")}>
          <LockIcon />
        </Tooltip>
      )}
    </div>
  );
}

export function IntegrationsCard({
  secrets,
  jiraBaseUrl,
  onJiraBaseUrlChange,
  jiraBaseUrlError,
}: IntegrationsCardProps) {
  const { t } = useTranslation();

  return (
    <div className="glass-card p-6 space-y-4">
      <h2 className="text-sm font-medium text-dark-200">
        {t("settings.integrations.title")}
      </h2>

      {/* JIRA Section */}
      <div className="bg-dark-800/50 border border-dark-700 rounded-lg p-4">
        <h3 className="text-sm font-medium text-dark-200 mb-3 flex items-center gap-2">
          <JiraLogo className="w-4 h-4 text-[#0052CC]" />
          {t("settings.integrations.jira.title")}
        </h3>
        <div className="space-y-1">
          <div className="flex items-center gap-4 py-1">
            <label htmlFor="jiraBaseUrl" className="text-sm text-dark-400 shrink-0 w-28">
              {t("settings.integrations.jira.baseUrl")}
            </label>
            <div className="flex-1">
              <input
                type="url"
                id="jiraBaseUrl"
                value={jiraBaseUrl}
                onChange={(e) => onJiraBaseUrlChange(e.target.value)}
                placeholder={t("settings.integrations.jira.baseUrlPlaceholder")}
                className={`w-full px-2 py-1 text-sm bg-dark-950/50 border rounded text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                  jiraBaseUrlError
                    ? "border-red-500/50 focus:ring-red-500/50"
                    : "border-dark-700 focus:ring-accent"
                }`}
              />
              {jiraBaseUrlError && (
                <p className="text-xs text-red-400 mt-1">{jiraBaseUrlError}</p>
              )}
            </div>
          </div>
          <SecretField
            label={t("settings.integrations.jira.email")}
            value={secrets.jira.email}
          />
          <SecretField
            label={t("settings.integrations.jira.apiToken")}
            value={secrets.jira.tokenMasked}
          />
          <SecretField
            label={t("settings.integrations.jira.webhookSecret")}
            value={secrets.jira.webhookSecretMasked}
          />
        </div>
      </div>

      {/* GitHub Section */}
      <div className="bg-dark-800/50 border border-dark-700 rounded-lg p-4">
        <h3 className="text-sm font-medium text-dark-200 mb-3 flex items-center gap-2">
          <GitHubLogo className="w-4 h-4 text-white" />
          {t("settings.integrations.github.title")}
        </h3>
        <div className="space-y-1">
          <SecretField
            label={t("settings.integrations.github.token")}
            value={secrets.github.tokenMasked}
          />
          <SecretField
            label={t("settings.integrations.github.webhookSecret")}
            value={secrets.github.webhookSecretMasked}
          />
        </div>
      </div>

      {/* Figma Section */}
      <div className="bg-dark-800/50 border border-dark-700 rounded-lg p-4">
        <h3 className="text-sm font-medium text-dark-200 mb-3 flex items-center gap-2">
          <FigmaLogo className="w-4 h-4" />
          {t("settings.integrations.figma.title")}
        </h3>
        <div className="space-y-1">
          <SecretField
            label={t("settings.integrations.figma.apiKey")}
            value={secrets.figma.apiKeyMasked}
          />
        </div>
      </div>
    </div>
  );
}
