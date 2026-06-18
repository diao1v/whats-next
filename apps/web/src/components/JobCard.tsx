import { useDraggable } from "@dnd-kit/core";
import { formatSalary, type Job, type Stage } from "@whats-next/shared";
import { StageSelect } from "./StageSelect";

export function JobCard({
  job, onSelect, onStageChange, onRetry,
}: {
  job: Job;
  onSelect: (id: string) => void;
  onStageChange: (id: string, stage: Stage) => void;
  onRetry: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: job.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;

  if (job.import_status === "importing") {
    return (
      <div className="rounded-xl border border-line bg-paper p-3 text-sm text-muted shadow-card">Importing…</div>
    );
  }

  return (
    <div ref={setNodeRef} style={style}
      className={`rounded-xl border border-line bg-paper p-3 shadow-card ${isDragging ? "opacity-60" : ""}`}>
      <div {...attributes} {...listeners} onClick={() => onSelect(job.id)} className="cursor-pointer">
        <div className="font-semibold text-ink">{job.job_title || "Untitled"}</div>
        <div className="text-xs text-muted">{job.company_name}{job.is_agency && job.agency_name ? ` (via ${job.agency_name})` : ""}</div>
        {formatSalary(job) && <div className="mt-1 text-xs font-medium text-ink">{formatSalary(job)}</div>}
      </div>
      {job.import_status === "failed" ? (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-red-600">Import failed</span>
          <button onClick={() => onRetry(job.id)}
            className="rounded-md bg-accent px-2 py-1 text-xs font-semibold text-paper">Retry</button>
        </div>
      ) : (
        <div className="mt-2">
          <StageSelect value={job.stage} onChange={(s) => onStageChange(job.id, s)} />
        </div>
      )}
    </div>
  );
}
