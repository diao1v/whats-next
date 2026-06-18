import { useState } from "react";
import { STAGES, type Job, type JobUpdate } from "@whats-next/shared";

export function JobDetailDrawer({
  job, onUpdate, onClose, onPaste,
}: {
  job: Job;
  onUpdate: (patch: JobUpdate) => void;
  onClose: () => void;
  onPaste: (text: string) => void;
}) {
  const [paste, setPaste] = useState("");
  return (
    <aside className="fixed right-0 top-0 h-full w-[28rem] overflow-y-auto border-l bg-white p-4 shadow-xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{job.job_title || "Untitled"}</h2>
        <button onClick={onClose} aria-label="Close">✕</button>
      </div>
      <p className="text-gray-600">{job.company_name}{job.is_agency && job.agency_name ? ` (via ${job.agency_name})` : ""}</p>

      {job.import_status === "needs_paste" && (
        <div className="my-3 rounded border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm">This page couldn't be read automatically. Paste the job description:</p>
          <textarea
            className="mt-2 w-full rounded border p-2 text-sm"
            placeholder="Paste the job description…"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <button className="mt-2 rounded bg-black px-3 py-1 text-sm text-white" onClick={() => onPaste(paste)}>
            Extract
          </button>
        </div>
      )}

      <label className="mt-4 block text-sm font-medium">
        Stage
        <select
          className="mt-1 block w-full rounded border p-2"
          value={job.stage}
          onChange={(e) => onUpdate({ stage: e.target.value as JobUpdate["stage"] })}
        >
          {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>

      <label className="mt-3 block text-sm font-medium">
        Applied date
        <input type="date" className="mt-1 block w-full rounded border p-2"
          value={job.applied_date ?? ""} onChange={(e) => onUpdate({ applied_date: e.target.value || null })} />
      </label>

      <label className="mt-3 block text-sm font-medium">
        Next action
        <input type="datetime-local" className="mt-1 block w-full rounded border p-2"
          value={job.next_action_at ?? ""} onChange={(e) => onUpdate({ next_action_at: e.target.value || null })} />
      </label>

      <label className="mt-3 block text-sm font-medium">
        Notes
        <textarea className="mt-1 block w-full rounded border p-2"
          defaultValue={job.notes} onBlur={(e) => onUpdate({ notes: e.target.value })} />
      </label>

      {job.skills.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium">Skills</h3>
          <div className="mt-1 flex flex-wrap gap-1">
            {job.skills.map((s) => <span key={s} className="rounded bg-gray-100 px-2 py-0.5 text-xs">{s}</span>)}
          </div>
        </div>
      )}

      {job.apply_url && (
        <a className="mt-4 inline-block text-blue-600 underline" href={job.apply_url} target="_blank" rel="noreferrer">
          Apply ↗
        </a>
      )}

      {job.description && (
        <p className="mt-4 text-sm text-gray-700">{job.description}</p>
      )}

      {job.snapshot && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium">Original snapshot</summary>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-600">{job.snapshot}</pre>
        </details>
      )}
    </aside>
  );
}
