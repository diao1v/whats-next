import { describe, it, expect } from "vitest";
import { stageFromDrop } from "./board";

describe("stageFromDrop", () => {
  it("returns the target stage when dropped on a different column", () => {
    expect(stageFromDrop("Saved", "Applied")).toBe("Applied");
  });
  it("returns null when dropped on the same column", () => {
    expect(stageFromDrop("Applied", "Applied")).toBeNull();
  });
  it("returns null for no drop target", () => {
    expect(stageFromDrop("Saved", null)).toBeNull();
  });
  it("returns null for an unknown target", () => {
    expect(stageFromDrop("Saved", "NotAStage")).toBeNull();
  });
});
