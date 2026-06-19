import { useJobs, useImportJob, useUpdateJob, useDeleteJob } from "./lib/queries";
import { useUiStore } from "./store/ui";
import type { Stage } from "@whats-next/shared";
import { Header } from "./components/Header";
import { ImportBar } from "./components/ImportBar";
import { JobBoard } from "./components/JobBoard";
import { JobList } from "./components/JobList";
import { JobDetailDrawer } from "./components/JobDetailDrawer";

export function App() {
  const { data: jobs = [], isLoading } = useJobs();
  const importJob = useImportJob();
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const view = useUiStore((s) => s.view);
  const selectedId = useUiStore((s) => s.selectedJobId);
  const selectJob = useUiStore((s) => s.selectJob);
  const selected = jobs.find((j) => j.id === selectedId) ?? null;

  const onStageChange = (id: string, stage: Stage) => updateJob.mutate({ id, patch: { stage } });
  const onRetry = (id: string) => {
    const job = jobs.find((j) => j.id === id);
    if (job) importJob.mutate({ url: job.url });
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <Header />
      <div className="mt-5">
        <ImportBar pending={importJob.isPending} onImport={(url) => importJob.mutate({ url })} />
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
          onPaste={(text) => importJob.mutate({ url: selected.url, pastedText: text })}
          onDelete={(id) => { deleteJob.mutate(id); selectJob(null); }}
          onRetry={onRetry}
        />
      )}
    </div>
  );
}
