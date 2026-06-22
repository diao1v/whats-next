import { describe, it, expect, vi } from "vitest";
import { buildImportRequest, send, normalizeApiUrl, interpretTestResponse, testConnection } from "./importClient";

describe("interpretTestResponse", () => {
  it("passes only on a JSON 200 (real API)", () => {
    expect(interpretTestResponse(200, "application/json")).toEqual({ ok: true, message: "Connection OK ✓" });
  });
  it("rejects an HTML 200 (SPA fallback / wrong URL = the web app)", () => {
    const r = interpretTestResponse(200, "text/html; charset=UTF-8");
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/api url/i);
  });
  it("treats 401 as reachable-but-bad-token", () => {
    const r = interpretTestResponse(401, "application/json");
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/token/i);
  });
  it("reports other statuses", () => {
    expect(interpretTestResponse(404, "text/plain").ok).toBe(false);
  });
});

describe("testConnection", () => {
  it("uses the normalized origin and maps a JSON 200 to ok", async () => {
    const f = vi.fn().mockResolvedValue(new Response("[]", { status: 200, headers: { "content-type": "application/json" } }));
    const r = await testConnection("http://localhost:8787/api/jobs", "wn_t", f);
    expect(f.mock.calls[0][0]).toBe("http://localhost:8787/api/jobs");
    expect(r.ok).toBe(true);
  });
  it("maps a network error to a friendly message", async () => {
    const f = vi.fn().mockRejectedValue(new Error("down"));
    expect((await testConnection("http://x", "t", f)).ok).toBe(false);
  });
});

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
