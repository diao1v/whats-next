import { useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { ChevronDown } from "lucide-react";
import { STAGES, type Job, type Stage } from "@whats-next/shared";
import { JobCard } from "./JobCard";
import { JobCardBody } from "./JobCardBody";
import { SkeletonCard } from "./Skeleton";
import { stageFromDrop } from "../lib/board";
import { useIsMobile } from "../lib/useIsMobile";

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

// ---- desktop: multi-column board with drag-and-drop ----------------------

function DesktopColumn({ stage, count, children }: { stage: Stage; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section ref={setNodeRef}
      className={`flex min-w-[200px] flex-1 flex-col rounded-2xl border border-line bg-[#faf1e6] p-2 ${isOver ? "ring-2 ring-primary/40" : ""}`}>
      <h2 className="mb-2 flex items-center justify-between px-1 text-sm font-bold text-ink">
        <span>{stage}</span><CountPill n={count} />
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function DesktopBoard({ jobs, onSelect, onStageChange, onRetry }: Omit<BoardProps, "loading">) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  function onDragEnd(e: DragEndEvent) {
    const job = jobs.find((x) => x.id === e.active.id);
    if (!job) return;
    const next = stageFromDrop(job.stage, e.over ? String(e.over.id) : null);
    if (next) onStageChange(job.id, next);
  }
  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {STAGES.map((stage) => {
          const items = jobs.filter((j) => j.stage === stage);
          return (
            <DesktopColumn key={stage} stage={stage} count={items.length}>
              {items.map((job) => (
                <JobCard key={job.id} job={job} onSelect={onSelect} onStageChange={onStageChange} onRetry={onRetry} />
              ))}
            </DesktopColumn>
          );
        })}
      </div>
    </DndContext>
  );
}

// ---- mobile: vertical collapsible stage sections -------------------------

function MobileBoard({ jobs, onSelect, onStageChange, onRetry }: Omit<BoardProps, "loading">) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(STAGES.map((s) => [s, true])));
  const toggle = (s: string) => setOpen((o) => ({ ...o, [s]: !o[s] }));

  return (
    <div className="space-y-2">
      {STAGES.map((stage) => {
        const items = jobs.filter((j) => j.stage === stage);
        const isOpen = open[stage];
        return (
          <section key={stage} className="overflow-hidden rounded-2xl border border-line bg-[#faf1e6]">
            <button type="button" onClick={() => toggle(stage)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left">
              <span className="flex items-center gap-2 text-sm font-bold text-ink">
                <ChevronDown size={16} className={`transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                {stage}
              </span>
              <CountPill n={items.length} />
            </button>
            {isOpen && (
              <div className="space-y-2 p-2 pt-0">
                {items.length === 0
                  ? <p className="px-1 pb-2 text-xs text-muted-foreground">Nothing here yet.</p>
                  : items.map((job) => (
                      <JobCardBody key={job.id} job={job} onSelect={onSelect} onStageChange={onStageChange} onRetry={onRetry} />
                    ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ---- entry point ---------------------------------------------------------

export function JobBoard(props: BoardProps) {
  const isMobile = useIsMobile();

  if (props.loading) {
    return (
      <div className="flex gap-3 overflow-x-auto sm:flex-row">
        {STAGES.slice(0, 4).map((s) => (
          <section key={s} className="flex min-w-[200px] flex-1 flex-col rounded-2xl border border-line bg-[#faf1e6] p-2">
            <h2 className="mb-2 px-1 text-sm font-bold text-ink">{s}</h2>
            <SkeletonCard />
          </section>
        ))}
      </div>
    );
  }

  return isMobile ? <MobileBoard {...props} /> : <DesktopBoard {...props} />;
}
