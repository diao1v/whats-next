import { describe, it, expect, vi, beforeEach } from "vitest";

const sonner = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), loading: vi.fn(), message: vi.fn(), dismiss: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign((...a: unknown[]) => sonner.message(...a), sonner) }));

import { notify } from "./toast";

beforeEach(() => Object.values(sonner).forEach((f) => f.mockReset()));

describe("notify", () => {
  it("added shows a success toast with title + company", () => {
    notify.added("Backend Eng", "Acme");
    expect(sonner.success).toHaveBeenCalledWith(expect.stringContaining("Backend Eng"));
  });
  it("moved shows the target stage", () => {
    notify.moved("Applied");
    expect(sonner.success).toHaveBeenCalledWith(expect.stringContaining("Applied"));
  });
  it("error shows an error toast", () => {
    notify.error("nope");
    expect(sonner.error).toHaveBeenCalledWith("nope");
  });
});
