import { describe, it, expect, vi } from "vitest";
import { buildImportRequest, send } from "./importClient";

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
