import { describe, it, expect, vi } from "vitest";
import { extractWithLLM } from "../src/extract/llm";

const valid = {
  company_name: "Acme", is_agency: false, agency_name: null, job_title: "Eng", role: "Backend",
  level: "Senior", salary_min: null, salary_max: null, salary_currency: null, salary_period: null,
  salary_raw_text: null, location: "Remote", is_remote: true, skills: ["TypeScript"], deadline: null,
  apply_url: null, description: "A backend role.",
};

function gatewayResponse(obj: unknown) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(obj) } }] }),
    { status: 200, headers: { "content-type": "application/json" } });
}

describe("extractWithLLM", () => {
  const cfg = { gatewayUrl: "https://gw/openrouter", apiKey: "k", models: ["test-model"], gatewayToken: "gw-token" };

  it("returns parsed, validated extraction plus the model used", async () => {
    const doFetch = vi.fn().mockResolvedValue(gatewayResponse(valid));
    const out = await extractWithLLM("job text", cfg, doFetch);
    expect(out.extraction.company_name).toBe("Acme");
    expect(out.extraction.skills).toEqual(["TypeScript"]);
    expect(out.model).toBe("test-model");
  });

  it("throws when the model returns invalid JSON schema", async () => {
    const doFetch = vi.fn().mockResolvedValue(gatewayResponse({ company_name: 123 }));
    await expect(extractWithLLM("job text", cfg, doFetch)).rejects.toThrow();
  });

  it("posts to the gateway chat completions endpoint with the model and auth headers", async () => {
    const doFetch = vi.fn().mockResolvedValue(gatewayResponse(valid));
    await extractWithLLM("job text", cfg, doFetch);
    const [url, init] = doFetch.mock.calls[0];
    expect(url).toBe("https://gw/openrouter/v1/chat/completions");
    expect(JSON.parse(init.body).model).toBe("test-model");
    expect(init.headers.Authorization).toBe("Bearer k");
    expect(init.headers["cf-aig-authorization"]).toBe("Bearer gw-token");
  });

  it("omits the gateway auth header when no token is configured", async () => {
    const doFetch = vi.fn().mockResolvedValue(gatewayResponse(valid));
    await extractWithLLM("job text", { ...cfg, gatewayToken: undefined }, doFetch);
    const [, init] = doFetch.mock.calls[0];
    expect(init.headers["cf-aig-authorization"]).toBeUndefined();
  });

  it("falls back to the next model when the first is rate-limited (429)", async () => {
    const doFetch = vi.fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(gatewayResponse(valid));
    const out = await extractWithLLM("job text", { ...cfg, models: ["primary", "fallback"] }, doFetch);
    expect(out.model).toBe("fallback");
    expect(out.extraction.company_name).toBe("Acme");
    expect(JSON.parse(doFetch.mock.calls[0][1].body).model).toBe("primary");
    expect(JSON.parse(doFetch.mock.calls[1][1].body).model).toBe("fallback");
  });

  it("throws when every model fails", async () => {
    const doFetch = vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 }));
    await expect(
      extractWithLLM("job text", { ...cfg, models: ["a", "b"] }, doFetch)
    ).rejects.toThrow();
    expect(doFetch).toHaveBeenCalledTimes(2);
  });
});
