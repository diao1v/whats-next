import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { JobBoard } from "./JobBoard";
import type { Job } from "@whats-next/shared";

const j = (over: Partial<Job>): Job => ({
  id: "j1", user_id: "u", company_name: "Acme", is_agency: false, agency_name: null,
  job_title: "Backend Eng", role: "R", level: null, salary_min: null, salary_max: null, salary_currency: null,
  salary_period: null, salary_raw_text: null, location: null, is_remote: false, deadline: null, url: "u",
  apply_url: null, source_site: null, snapshot: null, description: null, raw_content_key: null,
  source_method: "fetch", extraction_model: null, stage: "Saved", import_status: "ready",
  applied_date: null, next_action_at: null, notes: "", created_at: "", updated_at: "", skills: [], ...over,
});

function mockViewport(isMobile: boolean) {
  (window as { matchMedia?: unknown }).matchMedia = (query: string) => ({
    matches: isMobile, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  });
}

afterEach(() => { delete (window as { matchMedia?: unknown }).matchMedia; });

describe("JobBoard (desktop)", () => {
  it("renders a column per stage and places jobs", () => {
    render(<JobBoard jobs={[j({ id: "a", stage: "Saved" }), j({ id: "b", stage: "Applied" })]}
      loading={false} onSelect={vi.fn()} onStageChange={vi.fn()} onRetry={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /Saved/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Applied/ })).toBeInTheDocument();
    expect(screen.getAllByText("Backend Eng").length).toBe(2);
  });

  it("renders skeletons while loading", () => {
    const { container } = render(<JobBoard jobs={[]} loading={true} onSelect={vi.fn()} onStageChange={vi.fn()} onRetry={vi.fn()} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});

describe("JobBoard (mobile accordion)", () => {
  it("renders collapsible stage sections with counts and toggles them", () => {
    mockViewport(true);
    render(<JobBoard jobs={[j({ id: "a", stage: "Saved" })]}
      loading={false} onSelect={vi.fn()} onStageChange={vi.fn()} onRetry={vi.fn()} />);
    // Section headers are buttons (one per stage)
    const savedHeader = screen.getByRole("button", { name: /Saved/ });
    expect(savedHeader).toBeInTheDocument();
    expect(screen.getByText("Backend Eng")).toBeInTheDocument();
    // collapse hides the card
    fireEvent.click(savedHeader);
    expect(screen.queryByText("Backend Eng")).not.toBeInTheDocument();
  });
});
