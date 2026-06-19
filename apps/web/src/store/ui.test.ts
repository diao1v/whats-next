import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore } from "./ui";

describe("useUiStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.setState({ view: "board", selectedJobId: null });
  });

  it("defaults to board view", () => {
    expect(useUiStore.getState().view).toBe("board");
  });

  it("setView changes the view and persists it", () => {
    useUiStore.getState().setView("list");
    expect(useUiStore.getState().view).toBe("list");
    expect(localStorage.getItem("whats-next-ui")).toContain("list");
  });

  it("selectJob is not persisted", () => {
    useUiStore.getState().selectJob("j1");
    expect(useUiStore.getState().selectedJobId).toBe("j1");
    expect(localStorage.getItem("whats-next-ui") ?? "").not.toContain("j1");
  });
});
