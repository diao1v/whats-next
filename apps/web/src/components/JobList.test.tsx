import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { JobList } from "./JobList";
import type { Job } from "@whats-next/shared";

const j = (over: Partial<Job>): Job => ({
  id: "j1", user_id: "u", company_name: "Acme", is_agency: false, agency_name: null,
  job_title: "Backend Eng", role: "R", level: null, salary_min: 120000, salary_max: 150000,
  salary_currency: "NZD", salary_period: "year", salary_raw_text: null, location: "Remote", is_remote: true,
  deadline: null, url: "u", apply_url: null, source_site: "acme.com", snapshot: null, description: null,
  raw_content_key: null, source_method: "fetch", extraction_model: null, stage: "Saved", import_status: "ready",
  applied_date: null, next_action_at: null, notes: "", created_at: "", updated_at: "", skills: [], ...over,
});

describe("JobList", () => {
  it("renders a row per job with title and company", () => {
    render(<JobList jobs={[j({})]} loading={false} onSelect={vi.fn()} onStageChange={vi.fn()} />);
    expect(screen.getByText("Backend Eng")).toBeInTheDocument();
    expect(screen.getByText(/Acme/)).toBeInTheDocument();
  });

  it("row click opens the job", () => {
    const onSelect = vi.fn();
    render(<JobList jobs={[j({ id: "j9" })]} loading={false} onSelect={onSelect} onStageChange={vi.fn()} />);
    fireEvent.click(screen.getByText("Backend Eng"));
    expect(onSelect).toHaveBeenCalledWith("j9");
  });

  it("inline stage change calls onStageChange", async () => {
    const onStageChange = vi.fn();
    render(<JobList jobs={[j({ id: "j9" })]} loading={false} onSelect={vi.fn()} onStageChange={onStageChange} />);
    fireEvent.click(screen.getByLabelText(/change stage/i));
    fireEvent.click(await screen.findByRole("option", { name: "Applied" }));
    expect(onStageChange).toHaveBeenCalledWith("j9", "Applied");
  });

  it("filters by stage", () => {
    render(<JobList jobs={[j({ id: "a", stage: "Saved" }), j({ id: "b", job_title: "Designer", stage: "Applied" })]}
      loading={false} onSelect={vi.fn()} onStageChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/filter/i), { target: { value: "Applied" } });
    expect(screen.queryByText("Backend Eng")).not.toBeInTheDocument();
    expect(screen.getByText("Designer")).toBeInTheDocument();
  });

  it("shows level, deadline, and a link to the original posting", () => {
    render(<JobList jobs={[j({ level: "Senior", deadline: "2026-07-01", url: "https://acme.com/jobs/1" })]}
      loading={false} onSelect={vi.fn()} onStageChange={vi.fn()} />);
    expect(screen.getByText("Senior")).toBeInTheDocument();
    expect(screen.getByText(/2026-07-01/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /open original posting/i });
    expect(link).toHaveAttribute("href", "https://acme.com/jobs/1");
  });

  it("renders an importing job as a non-interactive loading row (no title, no stage select)", () => {
    const onSelect = vi.fn();
    render(<JobList jobs={[j({ id: "imp", import_status: "importing", job_title: "" })]}
      loading={false} onSelect={onSelect} onStageChange={vi.fn()} />);
    expect(screen.getByRole("status", { name: /extracting/i })).toBeInTheDocument();
    expect(screen.queryByText(/untitled/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/change stage/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("status", { name: /extracting/i }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows skeleton rows while loading", () => {
    const { container } = render(<JobList jobs={[]} loading={true} onSelect={vi.fn()} onStageChange={vi.fn()} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows an empty state when there are no jobs", () => {
    render(<JobList jobs={[]} loading={false} onSelect={vi.fn()} onStageChange={vi.fn()} />);
    expect(screen.getByText(/no jobs yet/i)).toBeInTheDocument();
  });
});
