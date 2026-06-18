import { renderHook } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { useIsMobile } from "./useIsMobile";

afterEach(() => { delete (window as { matchMedia?: unknown }).matchMedia; });

function mockMatchMedia(matches: boolean) {
  (window as { matchMedia?: unknown }).matchMedia = (query: string) => ({
    matches, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  });
}

describe("useIsMobile", () => {
  it("defaults to false when matchMedia is unavailable", () => {
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("is true when the media query matches", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("is false when the media query does not match", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});
