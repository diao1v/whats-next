import { STAGES, type Stage } from "@whats-next/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function StageSelect({
  value, onChange, className,
}: {
  value: Stage | string;
  onChange: (stage: Stage) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Stage)}>
      <SelectTrigger aria-label="Change stage" className={`h-8 w-auto gap-1 text-xs ${className ?? ""}`}
        onClick={(e) => e.stopPropagation()}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STAGES.map((s) => <SelectItem key={s} value={s} onClick={(e) => e.stopPropagation()}>{s}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
