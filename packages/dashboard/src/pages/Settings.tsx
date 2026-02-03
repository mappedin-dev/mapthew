import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useTranslation, Trans } from "react-i18next";
import { api } from "../api/client";
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

export default function Settings() {
  const { t } = useTranslation();
  const { botDisplayName } = useConfig();
  const queryClient = useQueryClient();
  const [botName, setBotName] = useState("");
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: config, isLoading, error } = useQuery({
    queryKey: ["config"],
    queryFn: api.getConfig,
  });

  useEffect(() => {
    if (config) {
      setBotName(config.botName);
    }
  }, [config]);

  const mutation = useMutation({
    mutationFn: (newBotName: string) => api.updateConfig({ botName: newBotName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const validationError = validateBotName(botName);
  const showError = touched && validationError;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow valid characters, auto-lowercase
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    setBotName(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!validationError) {
      mutation.mutate(botName);
    }
  };

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
        <p className="text-red-400">{t("settings.errorLoading", { message: (error as Error).message })}</p>
      </div>
    );
  }

  const hasChanges = botName !== config?.botName;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">{t("settings.title")}</h1>
        <p className="text-dark-400">{t("settings.description", { name: botDisplayName })}</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg space-y-6">
        <div className="glass-card p-6">
          <label htmlFor="botName" className="block text-sm font-medium text-dark-200 mb-3">
            {t("settings.botName.label")}
          </label>
          <div className="flex items-center gap-3">
            <span className="text-dark-400 text-lg">@</span>
              <input
                type="text"
                id="botName"
                value={botName}
                onChange={handleChange}
                onBlur={() => setTouched(true)}
                maxLength={32}
                autoComplete="off"
              className={`flex-1 px-4 py-3 bg-dark-950/50 border rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                showError
                  ? "border-red-500/50 focus:ring-red-500/50"
                  : "border-dark-700 focus:ring-accent"
              }`}
              placeholder={t("settings.botName.placeholder")}
            />
          </div>
          {showError && (
            <p className="text-sm text-red-400 mt-3">{validationError}</p>
          )}
          <p className={`text-sm text-dark-500 ${showError ? "mt-2" : "mt-3"}`}>
            {t("settings.botName.helpFormat")}
          </p>
          <p className="text-sm text-dark-500 mt-1">
            <Trans
              i18nKey="settings.botName.helpMention"
              values={{ botName: botName || "mapthew" }}
              components={{
                name: <code className="px-1.5 py-0.5 bg-dark-800 rounded text-accent" />
              }}
            />
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={mutation.isPending || !hasChanges || !!validationError}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t("common.saving")}
              </span>
            ) : (
              t("common.save")
            )}
          </button>
          {saved && (
            <span className="flex items-center gap-2 text-emerald-400 text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t("common.saved")}
            </span>
          )}
          {mutation.error && (
            <span className="text-red-400 text-sm">
              {(mutation.error as Error).message}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
