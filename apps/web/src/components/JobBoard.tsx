import { STAGES, type Job, type Stage } from "@seeking/shared";

export function JobBoard({ jobs, onSelect }: { jobs: Job[]; onSelect: (id: string) => void }) {
  const byStage = (s: Stage) => jobs.filter((j) => j.stage === s);
  return (
    <div className="grid grid-cols-6 gap-3">
      {STAGES.map((stage) => (
        <section key={stage} className="rounded bg-gray-50 p-2">
          <h2 className="mb-2 text-sm font-semibold">{stage}</h2>
          <div className="space-y-2">
            {byStage(stage).map((job) => (
              <button
                key={job.id}
                onClick={() => onSelect(job.id)}
                className="w-full rounded border bg-white p-2 text-left text-sm hover:shadow"
              >
                {job.import_status === "importing" ? (
                  <span className="text-gray-400">Importing…</span>
                ) : (
                  <>
                    <div className="font-medium">{job.job_title || "Untitled"}</div>
                    <div className="text-gray-500">{job.company_name}</div>
                    {job.import_status === "needs_paste" && (
                      <div className="mt-1 text-xs text-amber-600">Needs paste</div>
                    )}
                  </>
                )}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
