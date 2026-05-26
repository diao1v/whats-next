import { describe, it, expect, vi } from "vitest";
import { fetchContent } from "../src/extract/fetcher";

const richHtml = `<html><body><article>${"Great role at our company. ".repeat(60)}</article></body></html>`;
const thinHtml = `<html><body><div>Loading…</div></body></html>`;

describe("fetchContent", () => {
  it("returns fetch result when content is rich", async () => {
    const doFetch = vi.fn().mockResolvedValue(new Response(richHtml, { status: 200 }));
    const renderHtml = vi.fn();
    const out = await fetchContent("https://x.com/1", { doFetch, renderHtml });
    expect(out.method).toBe("fetch");
    expect(out.html).toBe(richHtml);
    expect(renderHtml).not.toHaveBeenCalled();
  });

  it("escalates to render when plain fetch is thin", async () => {
    const doFetch = vi.fn().mockResolvedValue(new Response(thinHtml, { status: 200 }));
    const renderHtml = vi.fn().mockResolvedValue(richHtml);
    const out = await fetchContent("https://x.com/1", { doFetch, renderHtml });
    expect(out.method).toBe("render");
    expect(out.html).toBe(richHtml);
  });

  it("returns needs_paste when render is still thin", async () => {
    const doFetch = vi.fn().mockResolvedValue(new Response(thinHtml, { status: 200 }));
    const renderHtml = vi.fn().mockResolvedValue(thinHtml);
    const out = await fetchContent("https://x.com/1", { doFetch, renderHtml });
    expect(out.method).toBe("needs_paste");
  });

  it("escalates to render when fetch fails", async () => {
    const doFetch = vi.fn().mockResolvedValue(new Response("blocked", { status: 403 }));
    const renderHtml = vi.fn().mockResolvedValue(richHtml);
    const out = await fetchContent("https://x.com/1", { doFetch, renderHtml });
    expect(out.method).toBe("render");
  });
});
