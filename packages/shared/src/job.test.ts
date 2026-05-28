import { describe, it, expect } from "vitest";
import { importStatusSchema, jobUpdateSchema } from "./job";

describe("job contracts", () => {
  it("accepts valid import statuses", () => {
    for (const s of ["importing", "needs_paste", "ready", "failed"]) {
      expect(importStatusSchema.parse(s)).toBe(s);
    }
  });
  it("jobUpdateSchema accepts a partial update", () => {
    const out = jobUpdateSchema.parse({ stage: "Applied", applied_date: "2026-05-26" });
    expect(out.stage).toBe("Applied");
  });
  it("jobUpdateSchema rejects unknown stage", () => {
    expect(() => jobUpdateSchema.parse({ stage: "Hired" })).toThrow();
  });
});
