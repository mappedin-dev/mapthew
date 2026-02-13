import { useState } from "react";
import { useTranslation } from "react-i18next";

export interface EditableIntegrationFieldProps {
  label: string;
  value: string;
  secretKey: string;
  onUpdate: (key: string, value: string) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
  inputType?: "text" | "url" | "email";
}

export function EditableIntegrationField({
  label,
  value,
  secretKey,
  onUpdate,
  onDelete,
  inputType = "text",
}: EditableIntegrationFieldProps) {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = !value;

  const handleSave = async (newValue: string) => {
    const trimmed = newValue.trim();
    if (trimmed === value) return;
    if (!trimmed) return;
    setIsSaving(true);
    setError(null);
    try {
      await onUpdate(secretKey, trimmed);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t("settings.integrations.deleteConfirm"))) return;
    setIsSaving(true);
    setError(null);
    try {
      await onDelete(secretKey);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="py-1">
      <div className="flex items-center gap-4">
        <span className="text-sm text-dark-400 shrink-0 w-28">{label}</span>
        <input
          key={value}
          type={inputType}
          defaultValue={value}
          onBlur={(e) => {
            const trimmed = e.target.value.trim();
            if (!trimmed && value) {
              // Reset to previous value if the user cleared the field
              e.target.value = value;
              return;
            }
            handleSave(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          disabled={isSaving}
          placeholder={t("settings.integrations.notConfigured")}
          className="flex-1 px-2 py-1 text-sm bg-dark-950/50 border border-dark-700 rounded text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50"
        />
        {!isEmpty && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSaving}
            title={t("settings.integrations.deleteSecret")}
            className="p-1 text-dark-500 hover:text-red-400 disabled:opacity-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400 mt-1 ml-32">{error}</p>}
    </div>
  );
}
