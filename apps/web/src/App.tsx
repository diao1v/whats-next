import { useJobs, useImportJob, useUpdateJob } from "./lib/queries";
import { useUiStore } from "./store/ui";
import { ImportBar } from "./components/ImportBar";
import { JobBoard } from "./components/JobBoard";
import { JobDetailDrawer } from "./components/JobDetailDrawer";

export function App() {
  const { data: jobs = [] } = useJobs();
  const importJob = useImportJob();
  const updateJob = useUpdateJob();
  const selectedId = useUiStore((s) => s.selectedJobId);
  const selectJob = useUiStore((s) => s.selectJob);
  const selected = jobs.find((j) => j.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-7xl p-6">
      <h1 className="mb-4 text-2xl font-bold">What&apos;s Next</h1>
      <ImportBar pending={importJob.isPending} onImport={(url) => importJob.mutate({ url })} />
      <div className="mt-6">
        <JobBoard jobs={jobs} onSelect={selectJob} />
      </div>
      {selected && (
        <JobDetailDrawer
          job={selected}
          onClose={() => selectJob(null)}
          onUpdate={(patch) => updateJob.mutate({ id: selected.id, patch })}
          onPaste={(text) => importJob.mutate({ url: selected.url, pastedText: text })}
        />
      )}
    </div>
  );
}
