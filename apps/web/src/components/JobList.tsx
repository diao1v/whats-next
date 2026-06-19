import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { STAGES, formatSalary, type Job, type Stage } from "@whats-next/shared";
import { StageSelect } from "./StageSelect";
import { Skeleton } from "./Skeleton";
import { EmptyState } from "./EmptyState";
import { sortJobs, filterJobs, type SortKey, type StageFilter } from "../lib/listView";

const GRID = "grid-cols-[2fr_1fr_auto] sm:grid-cols-[2.2fr_0.8fr_1.1fr_1fr_1.1fr_1fr_auto]";

export function JobList({
  jobs, loading, onSelect, onStageChange,
}: {
  jobs: Job[];
  loading: boolean;
  onSelect: (id: string) => void;
  onStageChange: (id: string, stage: Stage) => void;
}) {
  const [sort, setSort] = useState<SortKey>("updated");
  const [filter, setFilter] = useState<StageFilter>("all");
  const rows = useMemo(() => sortJobs(filterJobs(jobs, filter), sort), [jobs, filter, sort]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    );
  }
  if (jobs.length === 0) {
    return <EmptyState title="No jobs yet" message="Paste a job URL above to start tracking." />;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <label className="flex items-center gap-1 text-muted">
          Filter
          <select aria-label="Filter by stage" value={filter} onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-line bg-paper px-2 py-1 text-ink">
            <option value="all">All stages</option>
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1 text-muted">
          Sort
          <select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-line bg-paper px-2 py-1 text-ink">
            <option value="updated">Last updated</option>
            <option value="next_action">Next action</option>
            <option value="created">Date added</option>
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-paper shadow-card">
        <div className={`grid ${GRID} gap-2 border-b border-line bg-[#faf1e6] px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-muted`}>
          <div>Role / Company</div>
          <div className="hidden sm:block">Level</div>
          <div className="hidden sm:block">Salary</div>
          <div>Stage</div>
          <div className="hidden sm:block">Next action</div>
          <div className="hidden sm:block">Deadline</div>
          <div className="sr-only">Link</div>
        </div>
        {rows.map((job) => (
          <div key={job.id}
            onClick={() => onSelect(job.id)}
            className={`grid ${GRID} cursor-pointer items-center gap-2 border-b border-line/60 px-4 py-3 last:border-0 hover:bg-[#fdf8f3]`}>
            <div>
              <div className="font-semibold text-ink">{job.job_title || "Untitled"}</div>
              <div className="text-xs text-muted">{job.company_name}{job.is_agency && job.agency_name ? ` (via ${job.agency_name})` : ""}</div>
            </div>
            <div className="hidden text-sm text-muted sm:block">{job.level ?? "—"}</div>
            <div className="hidden text-sm text-ink sm:block">{formatSalary(job) ?? "—"}</div>
            <div>
              <StageSelect value={job.stage} onChange={(s) => onStageChange(job.id, s)} />
            </div>
            <div className="hidden text-sm text-muted sm:block">{job.next_action_at ?? "—"}</div>
            <div className="hidden text-sm text-muted sm:block">{job.deadline ?? "—"}</div>
            <a href={job.url} target="_blank" rel="noreferrer" aria-label="Open original posting"
              onClick={(e) => e.stopPropagation()}
              className="text-muted hover:text-accent-deep">
              <ExternalLink size={16} />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
