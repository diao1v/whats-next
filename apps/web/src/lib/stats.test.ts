import { describe, it, expect } from "vitest";
import { computeStats } from "./stats";
import type { Job } from "@whats-next/shared";

const j = (over: Partial<Job>): Job => ({
  id: "x", user_id: "u", company_name: "C", is_agency: false, agency_name: null, job_title: "T",
  role: "R", level: null, salary_min: null, salary_max: null, salary_currency: null, salary_period: null,
  salary_raw_text: null, location: null, is_remote: false, deadline: null, url: "u", apply_url: null,
  source_site: null, snapshot: null, description: null, raw_content_key: null, source_method: "fetch",
  extraction_model: null, stage: "Saved", import_status: "ready", applied_date: null, next_action_at: null,
  notes: "", created_at: "", updated_at: "", skills: [], ...over,
});

const NOW = new Date("2026-06-19T00:00:00Z");

describe("computeStats", () => {
  it("counts tracked, active, interviews, and due-this-week", () => {
    const jobs = [
      j({ stage: "Saved" }),
      j({ stage: "Applied", next_action_at: "2026-06-22T10:00" }),     // due within 7d
      j({ stage: "Phone screen" }),
      j({ stage: "Interview", next_action_at: "2026-07-30T10:00" }),   // not within 7d
      j({ stage: "Rejected/Closed" }),
    ];
    const s = computeStats(jobs, NOW);
    expect(s.tracked).toBe(5);
    expect(s.active).toBe(4);
    expect(s.interviews).toBe(2);
    expect(s.dueThisWeek).toBe(1);
  });

  it("returns zeros for an empty list", () => {
    expect(computeStats([], NOW)).toEqual({ tracked: 0, active: 0, interviews: 0, dueThisWeek: 0 });
  });
});
