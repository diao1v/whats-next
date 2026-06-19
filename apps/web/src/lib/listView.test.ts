import { describe, it, expect } from "vitest";
import { sortJobs, filterJobs, type SortKey } from "./listView";
import type { Job } from "@whats-next/shared";

const j = (over: Partial<Job>): Job => ({
  id: "x", user_id: "u", company_name: "C", is_agency: false, agency_name: null,
  job_title: "T", role: "R", level: null, salary_min: null, salary_max: null, salary_currency: null,
  salary_period: null, salary_raw_text: null, location: null, is_remote: false, deadline: null,
  url: "u", apply_url: null, source_site: null, snapshot: null, description: null, raw_content_key: null,
  source_method: "fetch", extraction_model: null, stage: "Saved", import_status: "ready",
  applied_date: null, next_action_at: null, notes: "", created_at: "2026-01-01", updated_at: "2026-01-01",
  skills: [], ...over,
});

describe("filterJobs", () => {
  it("returns all when filter is 'all'", () => {
    expect(filterJobs([j({}), j({ stage: "Applied" })], "all")).toHaveLength(2);
  });
  it("filters by stage", () => {
    const out = filterJobs([j({ stage: "Saved" }), j({ stage: "Applied" })], "Applied");
    expect(out).toHaveLength(1);
    expect(out[0].stage).toBe("Applied");
  });
});

describe("sortJobs", () => {
  it("sorts by soonest next action first, nulls last", () => {
    const out = sortJobs([
      j({ id: "none", next_action_at: null }),
      j({ id: "later", next_action_at: "2026-03-01" }),
      j({ id: "soon", next_action_at: "2026-02-01" }),
    ], "next_action" as SortKey);
    expect(out.map((x) => x.id)).toEqual(["soon", "later", "none"]);
  });
  it("sorts by updated, newest first", () => {
    const out = sortJobs([
      j({ id: "old", updated_at: "2026-01-01" }),
      j({ id: "new", updated_at: "2026-05-01" }),
    ], "updated");
    expect(out.map((x) => x.id)).toEqual(["new", "old"]);
  });
});
