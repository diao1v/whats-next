import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { STAGES, formatSalary, type Job, type JobUpdate } from "@whats-next/shared";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StageBadge } from "./StageBadge";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";

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
  const salary = formatSalary(job);

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{job.job_title || "Untitled"}</SheetTitle>
        </SheetHeader>
        <p className="text-sm text-muted-foreground">{job.company_name}{job.is_agency && job.agency_name ? ` (via ${job.agency_name})` : ""}</p>
        {salary && <p className="mt-1 text-sm font-medium">{salary}</p>}
        <div className="mt-2"><StageBadge stage={job.stage as never} /></div>

        {job.import_status === "failed" && (
          <div className="my-3 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <span className="text-sm font-semibold text-destructive">Import failed</span>
            <Button size="sm" onClick={() => onRetry(job.id)}>Retry</Button>
          </div>
        )}

        {job.import_status === "needs_paste" && (
          <div className="my-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="text-sm">This page couldn't be read automatically. Paste the job description:</p>
            <textarea className="mt-2 w-full rounded border border-input p-2 text-sm" placeholder="Paste the job description…"
              value={paste} onChange={(e) => setPaste(e.target.value)} />
            <Button size="sm" className="mt-2" onClick={() => onPaste(paste)}>Extract</Button>
          </div>
        )}

        <label className="mt-4 block text-sm font-medium">
          Stage
          <Select value={job.stage} onValueChange={(v) => onUpdate({ stage: v as JobUpdate["stage"] })}>
            <SelectTrigger aria-label="Change stage" className="mt-1 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </label>

        <label className="mt-3 block text-sm font-medium">
          Applied date
          <input type="date" className="mt-1 block w-full rounded-lg border border-input p-2"
            value={job.applied_date ?? ""} onChange={(e) => onUpdate({ applied_date: e.target.value || null })} />
        </label>

        <label className="mt-3 block text-sm font-medium">
          Next action
          <input type="datetime-local" className="mt-1 block w-full rounded-lg border border-input p-2"
            value={job.next_action_at ?? ""} onChange={(e) => onUpdate({ next_action_at: e.target.value || null })} />
        </label>

        <label className="mt-3 block text-sm font-medium">
          Notes
          <textarea className="mt-1 block w-full rounded-lg border border-input p-2"
            defaultValue={job.notes} onBlur={(e) => onUpdate({ notes: e.target.value })} />
        </label>

        {job.skills.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium">Skills</h3>
            <div className="mt-1 flex flex-wrap gap-1">
              {job.skills.map((s) => <span key={s} className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{s}</span>)}
            </div>
          </div>
        )}

        {job.apply_url && (
          <a className="mt-4 inline-flex items-center gap-1 text-accent-deep underline" href={job.apply_url} target="_blank" rel="noreferrer">Apply <ExternalLink size={14} /></a>
        )}

        {job.description && <p className="mt-4 text-sm">{job.description}</p>}

        {job.snapshot && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium">Original snapshot</summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{job.snapshot}</pre>
          </details>
        )}

        <div className="mt-6 border-t border-border pt-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="text-sm font-medium text-destructive">Delete</button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this job?</AlertDialogTitle>
                <AlertDialogDescription>This removes it from your board. You can undo right after.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(job.id)}>Confirm delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </SheetContent>
    </Sheet>
  );
}
