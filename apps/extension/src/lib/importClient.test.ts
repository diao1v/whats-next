import { describe, it, expect, vi } from "vitest";
import { buildImportRequest, send, normalizeApiUrl } from "./importClient";

describe("normalizeApiUrl", () => {
  it("strips a trailing path (e.g. an accidental /api/jobs) to the origin", () => {
    expect(normalizeApiUrl("http://localhost:8787/api/jobs")).toBe("http://localhost:8787");
  });
  it("strips a trailing slash", () => {
    expect(normalizeApiUrl("https://whats-next-api.example.workers.dev/")).toBe("https://whats-next-api.example.workers.dev");
  });
  it("adds https:// when the scheme is missing", () => {
    expect(normalizeApiUrl("whats-next-api.example.workers.dev")).toBe("https://whats-next-api.example.workers.dev");
  });
  it("returns the input unchanged when it can't be parsed", () => {
    expect(normalizeApiUrl("not a url")).toBe("not a url");
  });
});

describe("importClient", () => {
  it("builds a POST with bearer token and pastedText body", () => {
    const { url, init } = buildImportRequest("https://api.example", "wn_tok", { url: "https://job/1", text: "Job text" });
    expect(url).toBe("https://api.example/api/jobs/import");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer wn_tok");
    expect(JSON.parse(init.body as string)).toEqual({ url: "https://job/1", pastedText: "Job text" });
  });

  it("send maps a 201 to ok", async () => {
    const f = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    expect(await send("https://api.example", "wn_t", { url: "u", text: "x" }, f)).toEqual({ ok: true, status: 201 });
  });

  it("send maps a 401 to not-ok", async () => {
    const f = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    expect(await send("https://api.example", "wn_t", { url: "u", text: "x" }, f)).toEqual({ ok: false, status: 401 });
  });
});
