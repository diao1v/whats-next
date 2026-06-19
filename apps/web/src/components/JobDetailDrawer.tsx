import { useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { STAGES, formatSalary, type Job, type JobUpdate } from "@whats-next/shared";

export function JobDetailDrawer({
  job, onUpdate, onClose, onPaste, onDelete, onRetry,
}: {
  job: Job;
  onUpdate: (patch: JobUpdate) => void;
  onClose: () => void;
  onPaste: (text: string) => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const [paste, setPaste] = useState("");
  const [confirming, setConfirming] = useState(false);
  const salary = formatSalary(job);

  return (
    <aside className="fixed inset-x-0 bottom-0 top-auto max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-line bg-paper p-4 shadow-sheet sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 sm:max-h-none sm:w-[28rem] sm:rounded-none sm:border-l sm:border-t-0">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">{job.job_title || "Untitled"}</h2>
        <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-ink"><X size={18} /></button>
      </div>
      <p className="text-muted-foreground">{job.company_name}{job.is_agency && job.agency_name ? ` (via ${job.agency_name})` : ""}</p>
      {salary && <p className="mt-1 text-sm font-medium text-ink">{salary}</p>}

      {job.import_status === "failed" && (
        <div className="my-3 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3">
          <span className="text-sm font-semibold text-red-600">Import failed</span>
          <button onClick={() => onRetry(job.id)} className="rounded-md bg-primary px-3 py-1 text-sm font-semibold text-paper">Retry</button>
        </div>
      )}

      {job.import_status === "needs_paste" && (
        <div className="my-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm text-ink">This page couldn't be read automatically. Paste the job description:</p>
          <textarea className="mt-2 w-full rounded border border-line p-2 text-sm" placeholder="Paste the job description…"
            value={paste} onChange={(e) => setPaste(e.target.value)} />
          <button className="mt-2 rounded bg-ink px-3 py-1 text-sm text-paper" onClick={() => onPaste(paste)}>Extract</button>
        </div>
      )}

      <label className="mt-4 block text-sm font-medium text-ink">
        Stage
        <select className="mt-1 block w-full rounded-lg border border-line bg-paper p-2" value={job.stage}
          onChange={(e) => onUpdate({ stage: e.target.value as JobUpdate["stage"] })}>
          {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>

      <label className="mt-3 block text-sm font-medium text-ink">
        Applied date
        <input type="date" className="mt-1 block w-full rounded-lg border border-line p-2"
          value={job.applied_date ?? ""} onChange={(e) => onUpdate({ applied_date: e.target.value || null })} />
      </label>

      <label className="mt-3 block text-sm font-medium text-ink">
        Next action
        <input type="datetime-local" className="mt-1 block w-full rounded-lg border border-line p-2"
          value={job.next_action_at ?? ""} onChange={(e) => onUpdate({ next_action_at: e.target.value || null })} />
      </label>

      <label className="mt-3 block text-sm font-medium text-ink">
        Notes
        <textarea className="mt-1 block w-full rounded-lg border border-line p-2"
          defaultValue={job.notes} onBlur={(e) => onUpdate({ notes: e.target.value })} />
      </label>

      {job.skills.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-ink">Skills</h3>
          <div className="mt-1 flex flex-wrap gap-1">
            {job.skills.map((s) => <span key={s} className="rounded bg-[#f6ead9] px-2 py-0.5 text-xs text-[#7c5e3b]">{s}</span>)}
          </div>
        </div>
      )}

      {job.apply_url && (
        <a className="mt-4 inline-flex items-center gap-1 text-accent-deep underline" href={job.apply_url} target="_blank" rel="noreferrer">Apply <ExternalLink size={14} /></a>
      )}

      {job.description && <p className="mt-4 text-sm text-ink/90">{job.description}</p>}

      {job.snapshot && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-ink">Original snapshot</summary>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{job.snapshot}</pre>
        </details>
      )}

      <div className="mt-6 border-t border-line pt-4">
        {confirming ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink">Delete this job?</span>
            <button onClick={() => onDelete(job.id)} className="rounded-md bg-red-600 px-3 py-1 text-sm font-semibold text-paper" aria-label="Confirm delete">Confirm delete</button>
            <button onClick={() => setConfirming(false)} className="text-sm text-muted-foreground">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} className="text-sm font-medium text-red-600">Delete</button>
        )}
      </div>
    </aside>
  );
}
