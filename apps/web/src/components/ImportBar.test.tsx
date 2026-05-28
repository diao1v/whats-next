import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ImportBar } from "./ImportBar";

describe("ImportBar", () => {
  it("calls onImport with the entered url", () => {
    const onImport = vi.fn();
    render(<ImportBar onImport={onImport} pending={false} />);
    fireEvent.change(screen.getByPlaceholderText(/paste a job url/i), { target: { value: "https://acme.com/1" } });
    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    expect(onImport).toHaveBeenCalledWith("https://acme.com/1");
  });

  it("disables the button while pending", () => {
    render(<ImportBar onImport={vi.fn()} pending={true} />);
    expect(screen.getByRole("button", { name: /adding/i })).toBeDisabled();
  });
});
