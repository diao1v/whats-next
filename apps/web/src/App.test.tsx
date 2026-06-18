import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { useUiStore } from "./store/ui";

vi.mock("@clerk/clerk-react", () => ({ UserButton: () => <div data-testid="user-button" /> }));

const job = {
  id: "j1", company_name: "Acme", job_title: "Backend Eng", stage: "Saved", import_status: "ready",
  skills: [], is_agency: false, agency_name: null, applied_date: null, next_action_at: null, notes: "",
  apply_url: null, snapshot: null, description: null, salary_min: null, salary_max: null,
  salary_currency: null, salary_period: null, salary_raw_text: null, url: "u", user_id: "u",
  source_site: null, raw_content_key: null, source_method: "fetch", extraction_model: null,
  level: null, location: null, is_remote: false, deadline: null, created_at: "", updated_at: "",
};

vi.mock("./lib/queries", () => ({
  useJobs: () => ({ data: [job], isLoading: false }),
  useImportJob: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateJob: () => ({ mutate: vi.fn() }),
  useDeleteJob: () => ({ mutate: vi.fn() }),
}));

beforeEach(() => useUiStore.setState({ view: "board", selectedJobId: null }));

const renderApp = () => render(<QueryClientProvider client={new QueryClient()}><App /></QueryClientProvider>);

describe("App", () => {
  it("renders the import bar and board by default", () => {
    renderApp();
    expect(screen.getByPlaceholderText(/paste a job url/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Saved" })).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("switches to the list view via the toggle", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /list/i }));
    expect(screen.getByLabelText(/sort by/i)).toBeInTheDocument();
  });
});
