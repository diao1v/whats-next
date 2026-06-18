import { describe, it, expect } from "vitest";
import { contentHash } from "../src/extract/hash";

describe("contentHash", () => {
  it("is deterministic for identical input", async () => {
    expect(await contentHash("hello world")).toBe(await contentHash("hello world"));
  });
  it("differs for different input", async () => {
    expect(await contentHash("a")).not.toBe(await contentHash("b"));
  });
  it("returns a 64-char hex SHA-256 digest", async () => {
    expect(await contentHash("x")).toMatch(/^[0-9a-f]{64}$/);
  });
});
