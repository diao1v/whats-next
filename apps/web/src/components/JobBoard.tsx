import { DndContext, PointerSensor, useSensor, useSensors, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { ChevronDown, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { STAGES, type Job, type Stage } from "@whats-next/shared";
import { JobCard } from "./JobCard";
import { JobCardBody } from "./JobCardBody";
import { SkeletonCard } from "./Skeleton";
import { stageFromDrop } from "../lib/board";
import { useIsMobile } from "../lib/useIsMobile";
import { useUiStore } from "../store/ui";

interface BoardProps {
  jobs: Job[];
  loading: boolean;
  onSelect: (id: string) => void;
  onStageChange: (id: string, stage: Stage) => void;
  onRetry: (id: string) => void;
}

function CountPill({ n }: { n: number }) {
  return <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-semibold text-muted-foreground">{n}</span>;
}

function Lane({
  stage, jobs, open, isMobile, onToggle, onSelect, onStageChange, onRetry,
}: {
  stage: Stage; jobs: Job[]; open: boolean; isMobile: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onStageChange: (id: string, stage: Stage) => void;
  onRetry: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section ref={setNodeRef}
      className={`overflow-hidden rounded-2xl border border-line bg-[#faf1e6] ${isOver ? "ring-2 ring-primary/40" : ""}`}>
      <button type="button" onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left">
        <span className="flex items-center gap-2 text-sm font-bold text-ink">
          <ChevronDown size={16} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
          {stage}
        </span>
        <CountPill n={jobs.length} />
      </button>
      {open && (
        <div className="flex flex-wrap gap-2 p-2 pt-0">
          {jobs.length === 0
            ? <p className="px-1 pb-2 text-xs text-muted-foreground">Nothing here yet.</p>
            : jobs.map((job) => (
                <div key={job.id} className={isMobile ? "w-full" : "w-60"}>
                  {isMobile
                    ? <JobCardBody job={job} onSelect={onSelect} onStageChange={onStageChange} onRetry={onRetry} />
                    : <JobCard job={job} onSelect={onSelect} onStageChange={onStageChange} onRetry={onRetry} />}
                </div>
              ))}
        </div>
      )}
    </section>
  );
}

export function JobBoard({ jobs, loading, onSelect, onStageChange, onRetry }: BoardProps) {
  const isMobile = useIsMobile();
  const laneState = useUiStore((s) => s.laneState);
  const toggleLane = useUiStore((s) => s.toggleLane);
  const setAllLanes = useUiStore((s) => s.setAllLanes);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  if (loading) {
    return (
      <div className="space-y-2">
        {STAGES.slice(0, 3).map((s) => (
          <section key={s} className="rounded-2xl border border-line bg-[#faf1e6] p-2">
            <h2 className="mb-2 px-1 text-sm font-bold text-ink">{s}</h2>
            <SkeletonCard />
          </section>
        ))}
      </div>
    );
  }

  function onDragEnd(e: DragEndEvent) {
    const job = jobs.find((x) => x.id === e.active.id);
    if (!job) return;
    const next = stageFromDrop(job.stage, e.over ? String(e.over.id) : null);
    if (next) onStageChange(job.id, next);
  }

  const isOpen = (stage: Stage, count: number) => laneState[stage] ?? count > 0;

  return (
    <div>
      <div className="mb-2 flex justify-end gap-3 text-xs text-muted-foreground">
        <button type="button" className="inline-flex items-center gap-1 hover:text-ink" onClick={() => setAllLanes(true)}>
          <ChevronsUpDown size={14} /> Expand all
        </button>
        <button type="button" className="inline-flex items-center gap-1 hover:text-ink" onClick={() => setAllLanes(false)}>
          <ChevronsDownUp size={14} /> Collapse all
        </button>
      </div>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="space-y-2">
          {STAGES.map((stage) => {
            const items = jobs.filter((jb) => jb.stage === stage);
            const open = isOpen(stage, items.length);
            return (
              <Lane key={stage} stage={stage} jobs={items} open={open} isMobile={isMobile}
                onToggle={() => toggleLane(stage, open)}
                onSelect={onSelect} onStageChange={onStageChange} onRetry={onRetry} />
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}
