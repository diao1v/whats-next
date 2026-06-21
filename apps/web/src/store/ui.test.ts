import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore } from "./ui";

describe("useUiStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.setState({ view: "board", selectedJobId: null, laneState: {} });
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

  it("toggleLane records the opposite of the passed state and persists", () => {
    useUiStore.setState({ laneState: {} });
    useUiStore.getState().toggleLane("Saved", true);
    expect(useUiStore.getState().laneState["Saved"]).toBe(false);
    useUiStore.getState().toggleLane("Saved", false);
    expect(useUiStore.getState().laneState["Saved"]).toBe(true);
    expect(localStorage.getItem("whats-next-ui")).toContain("laneState");
  });

  it("setAllLanes sets every stage to the same state", () => {
    useUiStore.getState().setAllLanes(false);
    const ls = useUiStore.getState().laneState;
    expect(Object.keys(ls)).toContain("Offer");
    expect(Object.values(ls).every((v) => v === false)).toBe(true);
  });
});
