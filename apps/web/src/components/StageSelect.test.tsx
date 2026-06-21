import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StageSelect } from "./StageSelect";

describe("StageSelect", () => {
  it("fires onChange with the chosen stage", async () => {
    const onChange = vi.fn();
    render(<StageSelect value="Saved" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/change stage/i));   // open
    fireEvent.click(await screen.findByRole("option", { name: "Applied" }));
    expect(onChange).toHaveBeenCalledWith("Applied");
  });
});
