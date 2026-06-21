import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Job } from "@whats-next/shared";

const notify = vi.hoisted(() => ({ moved: vi.fn(), error: vi.fn(), added: vi.fn(), saved: vi.fn(), importing: vi.fn(), importFailed: vi.fn(), deletedWithUndo: vi.fn(), dismiss: vi.fn() }));
vi.mock("./toast", () => ({ notify }));

const api = vi.hoisted(() => ({ listJobs: vi.fn(), updateJob: vi.fn(), importJob: vi.fn(), deleteJob: vi.fn() }));
vi.mock("./api", () => ({ createApiClient: () => api, ApiError: class extends Error {} }));
vi.mock("@clerk/clerk-react", () => ({ useAuth: () => ({ getToken: async () => "t" }) }));

import { useUpdateJob, useJobs } from "./queries";

const job = (over: Partial<Job>): Job => ({ id: "j1", stage: "Saved", import_status: "ready", company_name: "Acme", job_title: "Eng", skills: [], user_id: "u", url: "u", is_agency: false, agency_name: null, role: "", level: null, salary_min: null, salary_max: null, salary_currency: null, salary_period: null, salary_raw_text: null, location: null, is_remote: false, deadline: null, apply_url: null, source_site: null, snapshot: null, description: null, raw_content_key: null, source_method: "fetch", extraction_model: null, applied_date: null, next_action_at: null, notes: "", created_at: "", updated_at: "", ...over });

function Harness() {
  const { data } = useJobs();
  const update = useUpdateJob();
  return (
    <div>
      <span data-testid="stage">{data?.[0]?.stage}</span>
      <button onClick={() => update.mutate({ id: "j1", patch: { stage: "Applied" } })}>move</button>
    </div>
  );
}

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><Harness /></QueryClientProvider>);
}

beforeEach(() => { Object.values(notify).forEach((f) => f.mockReset()); api.listJobs.mockResolvedValue([job({})]); });

describe("useUpdateJob optimistic", () => {
  it("updates the cache immediately and toasts on success", async () => {
    api.updateJob.mockResolvedValue(job({ stage: "Applied" }));
    setup();
    await screen.findByText("Saved");
    api.listJobs.mockResolvedValue([job({ stage: "Applied" })]); // server reflects the write after settle
    fireEvent.click(screen.getByText("move"));
    await waitFor(() => expect(screen.getByTestId("stage").textContent).toBe("Applied"));
    await waitFor(() => expect(notify.moved).toHaveBeenCalledWith("Applied"));
  });

  it("rolls back and shows an error toast on failure", async () => {
    api.updateJob.mockRejectedValue(new Error("boom"));
    setup();
    await screen.findByText("Saved");
    fireEvent.click(screen.getByText("move"));
    await waitFor(() => expect(notify.error).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId("stage").textContent).toBe("Saved"));
  });
});
