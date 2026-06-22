import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { JobDetailDrawer } from "./JobDetailDrawer";
import type { Job } from "@whats-next/shared";

const baseJob: Job = {
  id: "j1", user_id: "u1", company_name: "Acme", is_agency: false, agency_name: null,
  job_title: "Backend Eng", role: "Backend", level: "senior", salary_min: 120000, salary_max: 150000,
  salary_currency: "USD", salary_period: "year", salary_raw_text: "$120k-150k", location: "Remote",
  is_remote: true, deadline: null, url: "https://a.com/1", apply_url: "https://a.com/apply",
  source_site: "a.com", snapshot: "Job text", description: "Build backend things.", raw_content_key: "raw/j1.html", source_method: "fetch",
  extraction_model: "m", stage: "Saved", import_status: "ready", applied_date: null, next_action_at: null,
  notes: "", created_at: "", updated_at: "", skills: ["TypeScript"],
};

type Handlers = {
  onUpdate?: (patch: Partial<Job>) => void;
  onPaste?: (text: string) => void;
  onDelete?: (id: string) => void;
  onRetry?: (id: string) => void;
};
const render4 = (job: Job, over: Handlers = {}) =>
  render(<JobDetailDrawer job={job} onUpdate={(over.onUpdate ?? vi.fn()) as never} onClose={vi.fn()}
    onPaste={over.onPaste ?? vi.fn()} onDelete={over.onDelete ?? vi.fn()} onRetry={over.onRetry ?? vi.fn()} />);

describe("JobDetailDrawer", () => {
  it("changing stage calls onUpdate", async () => {
    const onUpdate = vi.fn();
    render4(baseJob, { onUpdate });
    fireEvent.click(screen.getByLabelText(/change stage/i));
    fireEvent.click(await screen.findByRole("option", { name: "Applied" }));
    expect(onUpdate).toHaveBeenCalledWith({ stage: "Applied" });
  });

  it("shows a paste box when import_status is needs_paste", () => {
    const onPaste = vi.fn();
    render4({ ...baseJob, import_status: "needs_paste" }, { onPaste });
    fireEvent.change(screen.getByPlaceholderText(/paste the job description/i), { target: { value: "Full text here" } });
    fireEvent.click(screen.getByRole("button", { name: /extract/i }));
    expect(onPaste).toHaveBeenCalledWith("Full text here");
  });

  it("shows the description summary", () => {
    render4(baseJob);
    expect(screen.getByText("Build backend things.")).toBeInTheDocument();
  });

  it("shows the salary formatted in its own currency", () => {
    render4({ ...baseJob, salary_currency: "NZD" });
    expect(screen.getByText(/120,000/)).toBeInTheDocument();
    expect(screen.getByText(/\/yr/)).toBeInTheDocument();
  });

  it("deletes after confirm", async () => {
    const onDelete = vi.fn();
    render4(baseJob, { onDelete });
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /confirm delete/i }));
    expect(onDelete).toHaveBeenCalledWith("j1");
  });

  it("shows Retry on a failed import", () => {
    const onRetry = vi.fn();
    render4({ ...baseJob, import_status: "failed" }, { onRetry });
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledWith("j1");
  });
});
