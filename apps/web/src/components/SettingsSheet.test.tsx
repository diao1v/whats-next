import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
const revoke = vi.fn();
vi.mock("../lib/queries", () => ({
  useTokens: () => ({ data: [{ id: "t1", name: "Chrome", created_at: "2026-01-01", last_used_at: null }] }),
  useCreateToken: () => ({ mutate: create, data: undefined, isPending: false }),
  useRevokeToken: () => ({ mutate: revoke }),
}));

import { SettingsSheet } from "./SettingsSheet";

beforeEach(() => { create.mockReset(); revoke.mockReset(); });

describe("SettingsSheet", () => {
  it("lists existing tokens and revokes", () => {
    render(<SettingsSheet open onOpenChange={vi.fn()} />);
    expect(screen.getByText("Chrome")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /revoke/i }));
    expect(revoke).toHaveBeenCalledWith("t1");
  });

  it("generates a token", () => {
    render(<SettingsSheet open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /generate token/i }));
    expect(create).toHaveBeenCalled();
  });
});
