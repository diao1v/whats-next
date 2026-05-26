import { describe, it, expect } from "vitest";
import { STAGES, stageSchema, isStage } from "./stages";

describe("stages", () => {
  it("lists pipeline stages in order", () => {
    expect(STAGES).toEqual([
      "Saved", "Applied", "Phone screen", "Interview", "Offer", "Rejected/Closed",
    ]);
  });
  it("validates a known stage", () => {
    expect(stageSchema.parse("Applied")).toBe("Applied");
  });
  it("rejects an unknown stage", () => {
    expect(() => stageSchema.parse("Hired")).toThrow();
  });
  it("isStage narrows correctly", () => {
    expect(isStage("Offer")).toBe(true);
    expect(isStage("nope")).toBe(false);
  });
});
