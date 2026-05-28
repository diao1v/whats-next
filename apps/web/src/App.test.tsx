import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";

// Mock the query hooks so App renders without Clerk/network.
vi.mock("./lib/queries", () => ({
  useJobs: () => ({ data: [{
    id: "j1", company_name: "Acme", job_title: "Backend Eng", stage: "Saved", import_status: "ready",
    skills: [], is_agency: false, agency_name: null, applied_date: null, next_action_at: null, notes: "",
    apply_url: null, snapshot: null,
  }], isLoading: false }),
  useImportJob: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateJob: () => ({ mutate: vi.fn() }),
  useDeleteJob: () => ({ mutate: vi.fn() }),
}));

it("renders the import bar and the board with a job", () => {
  render(<QueryClientProvider client={new QueryClient()}><App /></QueryClientProvider>);
  expect(screen.getByPlaceholderText(/paste a job url/i)).toBeInTheDocument();
  expect(screen.getByText("Acme")).toBeInTheDocument();
});
