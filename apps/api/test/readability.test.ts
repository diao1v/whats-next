import { describe, it, expect } from "vitest";
import { extractReadable, isThin } from "../src/extract/readability";
import greenhouse from "./fixtures/greenhouse.html?raw";
import thin from "./fixtures/thin.html?raw";

describe("extractReadable", () => {
  it("pulls substantial text from a real job page", () => {
    const out = extractReadable(greenhouse, "https://boards.greenhouse.io/x/jobs/1");
    expect(out.text.length).toBeGreaterThan(400);
    expect(out.text).toContain("Senior Backend Engineer");
    expect(isThin(out.text)).toBe(false);
  });
  it("flags a JS-shell page as thin", () => {
    const out = extractReadable(thin, "https://x.com");
    expect(isThin(out.text)).toBe(true);
  });
});
