import { useTranslation } from "react-i18next";
import type { SecretsStatus } from "@mapthew/shared/api-types";
import { EditableIntegrationField } from "./EditableIntegrationField";
import { EditableSecretField } from "./EditableSecretField";
import { JiraLogo } from "./JiraLogo";
import { GitHubLogo } from "./GitHubLogo";
import { FigmaLogo } from "./FigmaLogo";

interface IntegrationsCardProps {
  secrets: SecretsStatus;
  onSecretUpdate: (key: string, value: string) => Promise<void>;
  onSecretDelete: (key: string) => Promise<void>;
}

export function IntegrationsCard({
  secrets,
  onSecretUpdate,
  onSecretDelete,
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
          <EditableIntegrationField
            label={t("settings.integrations.jira.baseUrl")}
            value={secrets.jira.baseUrl}
            secretKey="jiraBaseUrl"
            onUpdate={onSecretUpdate}
            onDelete={onSecretDelete}
            inputType="url"
          />
          <EditableIntegrationField
            label={t("settings.integrations.jira.email")}
            value={secrets.jira.email}
            secretKey="jiraEmail"
            onUpdate={onSecretUpdate}
            onDelete={onSecretDelete}
            inputType="email"
          />
          <EditableSecretField
            label={t("settings.integrations.jira.apiToken")}
            value={secrets.jira.tokenMasked}
            secretKey="jiraApiToken"
            onUpdate={onSecretUpdate}
            onDelete={onSecretDelete}
          />
          <EditableSecretField
            label={t("settings.integrations.jira.webhookSecret")}
            value={secrets.jira.webhookSecretMasked}
            secretKey="jiraWebhookSecret"
            onUpdate={onSecretUpdate}
            onDelete={onSecretDelete}
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
          <EditableSecretField
            label={t("settings.integrations.github.token")}
            value={secrets.github.tokenMasked}
            secretKey="githubToken"
            onUpdate={onSecretUpdate}
            onDelete={onSecretDelete}
          />
          <EditableSecretField
            label={t("settings.integrations.github.webhookSecret")}
            value={secrets.github.webhookSecretMasked}
            secretKey="githubWebhookSecret"
            onUpdate={onSecretUpdate}
            onDelete={onSecretDelete}
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
          <EditableSecretField
            label={t("settings.integrations.figma.apiKey")}
            value={secrets.figma.apiKeyMasked}
            secretKey="figmaApiKey"
            onUpdate={onSecretUpdate}
            onDelete={onSecretDelete}
          />
        </div>
      </div>
    </div>
  );
}
