import { useState } from "react";
import { useTranslation } from "react-i18next";

export interface EditableSecretFieldProps {
  label: string;
  value: string;
  secretKey: string;
  onUpdate: (key: string, value: string) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
  inputType?: "password" | "text" | "url";
}

export function EditableSecretField({
  label,
  value,
  secretKey,
  onUpdate,
  onDelete,
  inputType = "password",
}: EditableSecretFieldProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = !value;

  const handleSave = async () => {
    if (!editValue.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      await onUpdate(secretKey, editValue.trim());
      setIsEditing(false);
      setEditValue("");
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

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue("");
    setError(null);
  };

  if (isEditing) {
    return (
      <div className="py-1">
        <div className="flex items-center gap-4">
          <span className="text-sm text-dark-400 shrink-0 w-28">{label}</span>
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
            autoFocus
            autoComplete="off"
            className="flex-1 px-2 py-1 text-sm bg-dark-950/50 border border-dark-700 rounded text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !editValue.trim()}
            title={t("settings.integrations.saveSecret")}
            className="p-1 w-6 h-6 flex items-center justify-center text-accent hover:text-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            title={t("settings.integrations.cancelEdit")}
            className="p-1 w-6 h-6 flex items-center justify-center text-dark-400 hover:text-dark-200 disabled:opacity-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {error && <p className="text-xs text-red-400 mt-1 ml-32">{error}</p>}
      </div>
    );
  }

  return (
    <div className="py-1">
      <div className="flex items-center gap-4">
        <span className="text-sm text-dark-400 shrink-0 w-28">{label}</span>
        <span className={`flex-1 text-sm font-mono ${value.includes("*") ? "tracking-wider" : ""} ${isEmpty ? "text-dark-600 italic" : "text-dark-300"}`}>
          {isEmpty ? t("settings.integrations.notConfigured") : value}
        </span>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          disabled={isSaving}
          title={t("settings.integrations.editSecret")}
          className="p-1 w-6 h-6 flex items-center justify-center text-dark-500 hover:text-dark-200 disabled:opacity-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
          </svg>
        </button>
        {!isEmpty && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSaving}
            title={t("settings.integrations.deleteSecret")}
            className="p-1 w-6 h-6 flex items-center justify-center text-dark-500 hover:text-red-400 disabled:opacity-50 transition-colors"
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
