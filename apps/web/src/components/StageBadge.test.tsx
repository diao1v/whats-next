import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StageBadge } from "./StageBadge";

describe("StageBadge", () => {
  it("renders the stage label", () => {
    render(<StageBadge stage="Applied" />);
    expect(screen.getByText("Applied")).toBeInTheDocument();
  });
  it("tags the element with the stage for styling", () => {
    render(<StageBadge stage="Interview" />);
    expect(screen.getByText("Interview")).toHaveAttribute("data-stage", "Interview");
  });
});
