import { DndContext, PointerSensor, useSensor, useSensors, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { STAGES, type Job, type Stage } from "@whats-next/shared";
import { JobCard } from "./JobCard";
import { SkeletonCard } from "./Skeleton";
import { stageFromDrop } from "../lib/board";

function Column({ stage, children }: { stage: Stage; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section ref={setNodeRef}
      className={`flex w-64 shrink-0 flex-col rounded-2xl border border-line bg-[#faf1e6] p-2 ${isOver ? "ring-2 ring-accent/40" : ""}`}>
      <h2 className="mb-2 px-1 text-sm font-bold text-ink">{stage}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

export function JobBoard({
  jobs, loading, onSelect, onStageChange, onRetry,
}: {
  jobs: Job[];
  loading: boolean;
  onSelect: (id: string) => void;
  onStageChange: (id: string, stage: Stage) => void;
  onRetry: (id: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function onDragEnd(e: DragEndEvent) {
    const job = jobs.find((x) => x.id === e.active.id);
    if (!job) return;
    const next = stageFromDrop(job.stage, e.over ? String(e.over.id) : null);
    if (next) onStageChange(job.id, next);
  }

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto">
        {STAGES.map((s) => (
          <section key={s} className="flex w-64 shrink-0 flex-col rounded-2xl border border-line bg-[#faf1e6] p-2">
            <h2 className="mb-2 px-1 text-sm font-bold text-ink">{s}</h2>
            <SkeletonCard />
          </section>
        ))}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {STAGES.map((stage) => (
          <Column key={stage} stage={stage}>
            {jobs.filter((j) => j.stage === stage).map((job) => (
              <JobCard key={job.id} job={job} onSelect={onSelect} onStageChange={onStageChange} onRetry={onRetry} />
            ))}
          </Column>
        ))}
      </div>
    </DndContext>
  );
}
