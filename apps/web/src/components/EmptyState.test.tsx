import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders title and message", () => {
    render(<EmptyState title="No jobs yet" message="Paste a URL above to start." />);
    expect(screen.getByText("No jobs yet")).toBeInTheDocument();
    expect(screen.getByText("Paste a URL above to start.")).toBeInTheDocument();
  });
});
