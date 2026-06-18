import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { JobBoard } from "./JobBoard";
import type { Job } from "@whats-next/shared";

const job = (over: Partial<Job>): Job => ({
  id: "j1", user_id: "u1", company_name: "Acme", is_agency: false, agency_name: null,
  job_title: "Backend Eng", role: "Backend", level: "Senior", salary_min: null, salary_max: null,
  salary_currency: null, salary_period: null, salary_raw_text: null, location: "Remote", is_remote: true,
  deadline: null, url: "https://a.com/1", apply_url: null, source_site: "a.com", snapshot: null,
  description: null, raw_content_key: null, source_method: "fetch", extraction_model: "m", stage: "Saved",
  import_status: "ready", applied_date: null, next_action_at: null, notes: "", created_at: "", updated_at: "",
  skills: ["TypeScript"], ...over,
});

describe("JobBoard", () => {
  it("renders a column per stage and places jobs by stage", () => {
    render(<JobBoard jobs={[job({ id: "a", stage: "Saved" }), job({ id: "b", stage: "Applied" })]} onSelect={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Saved" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Applied" })).toBeInTheDocument();
    expect(screen.getAllByText("Backend Eng").length).toBeGreaterThan(0);
  });

  it("shows an importing badge for jobs still importing", () => {
    render(<JobBoard jobs={[job({ stage: "Saved", import_status: "importing", company_name: "" })]} onSelect={vi.fn()} />);
    expect(screen.getByText(/importing/i)).toBeInTheDocument();
  });
});
