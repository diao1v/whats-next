import type { Job } from "@whats-next/shared";

export type SortKey = "next_action" | "updated" | "created";
export type StageFilter = "all" | string;

export function filterJobs(jobs: Job[], filter: StageFilter): Job[] {
  return filter === "all" ? jobs : jobs.filter((j) => j.stage === filter);
}

export function sortJobs(jobs: Job[], key: SortKey): Job[] {
  const copy = [...jobs];
  if (key === "next_action") {
    return copy.sort((a, b) => {
      if (!a.next_action_at && !b.next_action_at) return 0;
      if (!a.next_action_at) return 1;   // nulls last
      if (!b.next_action_at) return -1;
      return a.next_action_at.localeCompare(b.next_action_at); // soonest first
    });
  }
  const field = key === "updated" ? "updated_at" : "created_at";
  return copy.sort((a, b) => (b[field] ?? "").localeCompare(a[field] ?? "")); // newest first
}
