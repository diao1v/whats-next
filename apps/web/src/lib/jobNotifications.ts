export type JobLike = { id: string; import_status: string; job_title: string; company_name: string };
export type JobToast = { kind: "added"; title: string; company: string } | { kind: "failed" };

/**
 * Decide which toasts to fire for the current jobs vs. what we've already seen.
 * - A brand-new job (id not in `seen`) that's already `ready` → "added" (e.g. arrived from
 *   the extension). A brand-new still-importing job stays silent until it flips.
 * - A known job transitioning importing → ready/failed → "added"/"failed".
 * - Everything else (incl. a restored job reappearing) → silent.
 * Caller seeds `seen`/`prevStatus` on first load so initial jobs don't toast.
 */
export function diffJobToasts(
  seen: Set<string>, prevStatus: Map<string, string>, jobs: JobLike[]
): JobToast[] {
  const toasts: JobToast[] = [];
  for (const j of jobs) {
    const was = prevStatus.get(j.id);
    if (!seen.has(j.id)) {
      if (j.import_status === "ready") toasts.push({ kind: "added", title: j.job_title, company: j.company_name });
    } else if (was === "importing" && j.import_status === "ready") {
      toasts.push({ kind: "added", title: j.job_title, company: j.company_name });
    } else if (was === "importing" && j.import_status === "failed") {
      toasts.push({ kind: "failed" });
    }
  }
  return toasts;
}
