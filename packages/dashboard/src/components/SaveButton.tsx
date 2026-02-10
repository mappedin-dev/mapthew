interface SaveButtonProps {
  isPending: boolean;
  isSaved: boolean;
  disabled?: boolean;
  label?: string;
}

export function SaveButton({
  isPending,
  isSaved,
  disabled = false,
  label = "Save",
}: SaveButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={`${isSaved ? "btn-success" : "btn-primary"} min-w-[90px] h-[42px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300`}
    >
      {isPending ? (
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : isSaved ? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        label
      )}
    </button>
  );
}
