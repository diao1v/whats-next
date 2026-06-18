import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { ViewToggle } from "./ViewToggle";
import { useUiStore } from "../store/ui";

describe("ViewToggle", () => {
  beforeEach(() => useUiStore.setState({ view: "board" }));

  it("switches the store view when a button is clicked", () => {
    render(<ViewToggle />);
    fireEvent.click(screen.getByRole("button", { name: /list/i }));
    expect(useUiStore.getState().view).toBe("list");
    fireEvent.click(screen.getByRole("button", { name: /board/i }));
    expect(useUiStore.getState().view).toBe("board");
  });
});
