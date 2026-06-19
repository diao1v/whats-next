import type { Job } from "@whats-next/shared";

export interface Stats { tracked: number; active: number; interviews: number; dueThisWeek: number; }

export function computeStats(jobs: Job[], now: Date): Stats {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const horizon = now.getTime() + weekMs;
  let active = 0, interviews = 0, dueThisWeek = 0;
  for (const j of jobs) {
    if (j.stage !== "Rejected/Closed") active++;
    if (j.stage === "Phone screen" || j.stage === "Interview") interviews++;
    if (j.next_action_at) {
      const t = new Date(j.next_action_at).getTime();
      if (!Number.isNaN(t) && t >= now.getTime() && t <= horizon) dueThisWeek++;
    }
  }
  return { tracked: jobs.length, active, interviews, dueThisWeek };
}
