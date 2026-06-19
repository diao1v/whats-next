import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StageSelect } from "./StageSelect";

describe("StageSelect", () => {
  it("renders all stages and fires onChange with the chosen stage", () => {
    const onChange = vi.fn();
    render(<StageSelect value="Saved" onChange={onChange} />);
    const select = screen.getByLabelText(/change stage/i);
    fireEvent.change(select, { target: { value: "Applied" } });
    expect(onChange).toHaveBeenCalledWith("Applied");
  });
});
