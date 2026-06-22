import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useJobs, useImportJob, useUpdateJob, useDeleteJob, useRestoreJob } from "./lib/queries";
import { useUiStore } from "./store/ui";
import { computeStats } from "./lib/stats";
import { notify } from "./lib/toast";
import { diffJobToasts } from "./lib/jobNotifications";
import type { Job, Stage } from "@whats-next/shared";
import { Header } from "./components/Header";
import { ImportBar } from "./components/ImportBar";
import { StatsBar } from "./components/StatsBar";
import { JobBoard } from "./components/JobBoard";
import { JobList } from "./components/JobList";
import { JobDetailDrawer } from "./components/JobDetailDrawer";

export function App() {
  const { data: jobs = [], isLoading } = useJobs();
  const qc = useQueryClient();
  const importJob = useImportJob();
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const restoreJob = useRestoreJob();
  const view = useUiStore((s) => s.view);
  const selectedId = useUiStore((s) => s.selectedJobId);
  const selectJob = useUiStore((s) => s.selectJob);
  const selected = jobs.find((j) => j.id === selectedId) ?? null;

  // Toasts for jobs finishing import (local) or arriving (extension), but not on first
  // load or on restore. `seen` distinguishes genuinely-new ids from reappearing ones.
  const prevStatus = useRef<Map<string, string>>(new Map());
  const seen = useRef<Set<string>>(new Set());
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current) {
      jobs.forEach((j) => seen.current.add(j.id));
      prevStatus.current = new Map(jobs.map((j) => [j.id, j.import_status]));
      seeded.current = true;
      return;
    }
    for (const t of diffJobToasts(seen.current, prevStatus.current, jobs)) {
      notify.dismiss("import");
      if (t.kind === "added") notify.added(t.title, t.company);
      else notify.importFailed();
    }
    jobs.forEach((j) => seen.current.add(j.id));
    prevStatus.current = new Map(jobs.map((j) => [j.id, j.import_status]));
  }, [jobs]);

  const startImport = (req: { url: string; pastedText?: string }) => {
    notify.importing();
    importJob.mutate(req);
  };
  const onStageChange = (id: string, stage: Stage) => updateJob.mutate({ id, patch: { stage } });
  const onRetry = (id: string) => {
    const job = jobs.find((j) => j.id === id);
    if (job) startImport({ url: job.url });
  };

  // Soft delete: commit immediately (survives refresh), remove optimistically, Undo restores.
  const onDelete = (id: string) => {
    const prevJobs = qc.getQueryData<Job[]>(["jobs"]) ?? [];
    qc.setQueryData<Job[]>(["jobs"], prevJobs.filter((j) => j.id !== id));
    selectJob(null);
    deleteJob.mutate(id);
    notify.deletedWithUndo(() => {
      qc.setQueryData<Job[]>(["jobs"], prevJobs); // optimistic re-add
      restoreJob.mutate(id);
    });
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <Header />
      <div className="mt-5"><StatsBar stats={computeStats(jobs, new Date())} /></div>
      <div className="mt-4">
        <ImportBar pending={importJob.isPending} onImport={(url) => startImport({ url })} />
      </div>
      <div className="mt-6">
        {view === "board" ? (
          <JobBoard jobs={jobs} loading={isLoading} onSelect={selectJob} onStageChange={onStageChange} onRetry={onRetry} />
        ) : (
          <JobList jobs={jobs} loading={isLoading} onSelect={selectJob} onStageChange={onStageChange} />
        )}
      </div>
      {selected && (
        <JobDetailDrawer
          job={selected}
          onClose={() => selectJob(null)}
          onUpdate={(patch) => updateJob.mutate({ id: selected.id, patch })}
          onPaste={(text) => startImport({ url: selected.url, pastedText: text })}
          onDelete={onDelete}
          onRetry={onRetry}
        />
      )}
    </div>
  );
}
