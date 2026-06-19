import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatsBar } from "./StatsBar";

describe("StatsBar", () => {
  it("renders the four labelled stats", () => {
    render(<StatsBar stats={{ tracked: 12, active: 7, interviews: 2, dueThisWeek: 3 }} />);
    for (const label of ["Tracked", "Active", "Interviews", "Due this week"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });
});
