import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { JobBoard } from "./JobBoard";
import { useUiStore } from "../store/ui";
import type { Job } from "@whats-next/shared";

const j = (over: Partial<Job>): Job => ({
  id: "j1", user_id: "u", company_name: "Acme", is_agency: false, agency_name: null,
  job_title: "Backend Eng", role: "R", level: null, salary_min: null, salary_max: null, salary_currency: null,
  salary_period: null, salary_raw_text: null, location: null, is_remote: false, deadline: null, url: "u",
  apply_url: null, source_site: null, snapshot: null, description: null, raw_content_key: null,
  source_method: "fetch", extraction_model: null, stage: "Saved", import_status: "ready",
  applied_date: null, next_action_at: null, notes: "", created_at: "", updated_at: "", skills: [], ...over,
});

const props = (jobs: Job[], loading = false) => ({
  jobs, loading, onSelect: vi.fn(), onStageChange: vi.fn(), onRetry: vi.fn(),
});

beforeEach(() => { localStorage.clear(); useUiStore.setState({ laneState: {} }); });

describe("JobBoard lanes", () => {
  it("renders a lane header for every stage", () => {
    render(<JobBoard {...props([j({})])} />);
    for (const stage of ["Saved", "Applied", "Phone screen", "Interview", "Offer", "Rejected/Closed"]) {
      expect(screen.getByRole("button", { name: new RegExp(stage.replace("/", "\\/")) })).toBeInTheDocument();
    }
  });

  it("opens non-empty lanes and collapses empty ones by default", () => {
    render(<JobBoard {...props([j({ id: "a", stage: "Saved" })])} />);
    expect(screen.getByText("Backend Eng")).toBeInTheDocument();
    expect(screen.queryByText(/nothing here yet/i)).not.toBeInTheDocument();
  });

  it("toggling a lane header hides its cards", () => {
    render(<JobBoard {...props([j({ stage: "Saved" })])} />);
    fireEvent.click(screen.getByRole("button", { name: /Saved/ }));
    expect(screen.queryByText("Backend Eng")).not.toBeInTheDocument();
  });

  it("Collapse all hides cards; Expand all shows them", () => {
    render(<JobBoard {...props([j({ stage: "Saved" })])} />);
    fireEvent.click(screen.getByRole("button", { name: /collapse all/i }));
    expect(screen.queryByText("Backend Eng")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /expand all/i }));
    expect(screen.getByText("Backend Eng")).toBeInTheDocument();
  });

  it("clicking a card calls onSelect", () => {
    const p = props([j({ id: "z", stage: "Saved" })]);
    render(<JobBoard {...p} />);
    fireEvent.click(screen.getByText("Backend Eng"));
    expect(p.onSelect).toHaveBeenCalledWith("z");
  });

  it("renders skeletons while loading", () => {
    const { container } = render(<JobBoard {...props([], true)} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
