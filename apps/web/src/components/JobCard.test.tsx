import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DndContext } from "@dnd-kit/core";
import { JobCard } from "./JobCard";
import type { Job } from "@whats-next/shared";

const j = (over: Partial<Job>): Job => ({
  id: "j1", user_id: "u", company_name: "Acme", is_agency: false, agency_name: null,
  job_title: "Backend Eng", role: "R", level: null, salary_min: null, salary_max: null, salary_currency: null,
  salary_period: null, salary_raw_text: null, location: null, is_remote: false, deadline: null, url: "u",
  apply_url: null, source_site: null, snapshot: null, description: null, raw_content_key: null,
  source_method: "fetch", extraction_model: null, stage: "Saved", import_status: "ready",
  applied_date: null, next_action_at: null, notes: "", created_at: "", updated_at: "", skills: [], ...over,
});

const wrap = (ui: React.ReactNode) => <DndContext>{ui}</DndContext>;

describe("JobCard", () => {
  it("shows title and company, opens on click", () => {
    const onSelect = vi.fn();
    render(wrap(<JobCard job={j({ id: "j7" })} onSelect={onSelect} onStageChange={vi.fn()} onRetry={vi.fn()} />));
    expect(screen.getByText("Backend Eng")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Backend Eng"));
    expect(onSelect).toHaveBeenCalledWith("j7");
  });

  it("shows Importing for an importing job", () => {
    render(wrap(<JobCard job={j({ import_status: "importing" })} onSelect={vi.fn()} onStageChange={vi.fn()} onRetry={vi.fn()} />));
    expect(screen.getByText(/importing/i)).toBeInTheDocument();
  });

  it("shows a Retry button on a failed import", () => {
    const onRetry = vi.fn();
    render(wrap(<JobCard job={j({ id: "j7", import_status: "failed" })} onSelect={vi.fn()} onStageChange={vi.fn()} onRetry={onRetry} />));
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledWith("j7");
  });
});
