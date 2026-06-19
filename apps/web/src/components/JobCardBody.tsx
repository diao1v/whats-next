import type { useDraggable } from "@dnd-kit/core";
import { Loader2 } from "lucide-react";
import { formatSalary, type Job, type Stage } from "@whats-next/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StageSelect } from "./StageSelect";

type Drag = ReturnType<typeof useDraggable>;

/** Presentational job card. Pass `drag` (from useDraggable) to make it draggable; omit for a static card. */
export function JobCardBody({
  job, onSelect, onStageChange, onRetry, drag,
}: {
  job: Job;
  onSelect: (id: string) => void;
  onStageChange: (id: string, stage: Stage) => void;
  onRetry: (id: string) => void;
  drag?: Drag;
}) {
  if (job.import_status === "importing") {
    return (
      <Card className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
        <Loader2 className="animate-spin" size={14} /> Extracting…
      </Card>
    );
  }

  const style = drag?.transform ? { transform: `translate(${drag.transform.x}px, ${drag.transform.y}px)` } : undefined;

  return (
    <Card ref={drag?.setNodeRef} style={style} className={`p-3 ${drag?.isDragging ? "opacity-60" : ""}`}>
      <div {...(drag?.attributes)} {...(drag?.listeners)} onClick={() => onSelect(job.id)} className="cursor-pointer">
        <div className="font-semibold">{job.job_title || "Untitled"}</div>
        <div className="text-xs text-muted-foreground">{job.company_name}{job.is_agency && job.agency_name ? ` (via ${job.agency_name})` : ""}</div>
        {formatSalary(job) && <div className="mt-1 text-xs font-medium">{formatSalary(job)}</div>}
      </div>
      {job.import_status === "failed" ? (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-destructive">Import failed</span>
          <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => onRetry(job.id)}>Retry</Button>
        </div>
      ) : (
        <div className="mt-2"><StageSelect value={job.stage} onChange={(s) => onStageChange(job.id, s)} /></div>
      )}
    </Card>
  );
}
