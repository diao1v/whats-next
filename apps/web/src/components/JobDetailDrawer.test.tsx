import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { JobDetailDrawer } from "./JobDetailDrawer";
import type { Job } from "@whats-next/shared";

const baseJob: Job = {
  id: "j1", user_id: "u1", company_name: "Acme", is_agency: false, agency_name: null,
  job_title: "Backend Eng", role: "Backend", level: "Senior", salary_min: 120000, salary_max: 150000,
  salary_currency: "USD", salary_period: "year", salary_raw_text: "$120k-150k", location: "Remote",
  is_remote: true, deadline: null, url: "https://a.com/1", apply_url: "https://a.com/apply",
  source_site: "a.com", snapshot: "Job text", description: "Build backend things.", raw_content_key: "raw/j1.html", source_method: "fetch",
  extraction_model: "m", stage: "Saved", import_status: "ready", applied_date: null, next_action_at: null,
  notes: "", created_at: "", updated_at: "", skills: ["TypeScript"],
};

describe("JobDetailDrawer", () => {
  it("changing stage calls onUpdate", () => {
    const onUpdate = vi.fn();
    render(<JobDetailDrawer job={baseJob} onUpdate={onUpdate} onClose={vi.fn()} onPaste={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/stage/i), { target: { value: "Applied" } });
    expect(onUpdate).toHaveBeenCalledWith({ stage: "Applied" });
  });

  it("shows a paste box when import_status is needs_paste", () => {
    const onPaste = vi.fn();
    render(<JobDetailDrawer job={{ ...baseJob, import_status: "needs_paste" }} onUpdate={vi.fn()} onClose={vi.fn()} onPaste={onPaste} />);
    fireEvent.change(screen.getByPlaceholderText(/paste the job description/i), { target: { value: "Full text here" } });
    fireEvent.click(screen.getByRole("button", { name: /extract/i }));
    expect(onPaste).toHaveBeenCalledWith("Full text here");
  });

  it("shows the description summary", () => {
    render(<JobDetailDrawer job={baseJob} onUpdate={vi.fn()} onClose={vi.fn()} onPaste={vi.fn()} />);
    expect(screen.getByText("Build backend things.")).toBeInTheDocument();
  });

  it("shows the salary formatted in its own currency", () => {
    const job = { ...baseJob, salary_min: 120000, salary_max: 150000, salary_currency: "NZD", salary_period: "year" };
    render(<JobDetailDrawer job={job} onUpdate={vi.fn()} onClose={vi.fn()} onPaste={vi.fn()} />);
    expect(screen.getByText(/120,000/)).toBeInTheDocument();
    expect(screen.getByText(/\/yr/)).toBeInTheDocument();
  });
});
