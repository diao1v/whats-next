import { STAGES, type Stage } from "@whats-next/shared";

export function StageSelect({
  value, onChange, className,
}: {
  value: Stage | string;
  onChange: (stage: Stage) => void;
  className?: string;
}) {
  return (
    <select
      aria-label="Change stage"
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value as Stage)}
      className={`rounded-lg border border-line bg-paper px-2 py-1 text-xs text-ink ${className ?? ""}`}
    >
      {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}
