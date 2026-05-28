import { describe, it, expect, vi } from "vitest";
import { extractWithLLM } from "../src/extract/llm";

const valid = {
  company_name: "Acme", is_agency: false, agency_name: null, job_title: "Eng", role: "Backend",
  level: "Senior", salary_min: null, salary_max: null, salary_currency: null, salary_period: null,
  salary_raw_text: null, location: "Remote", is_remote: true, skills: ["TypeScript"], deadline: null,
  apply_url: null,
};

function gatewayResponse(obj: unknown) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(obj) } }] }),
    { status: 200, headers: { "content-type": "application/json" } });
}

describe("extractWithLLM", () => {
  const cfg = { gatewayUrl: "https://gw/openrouter", apiKey: "k", model: "test-model" };

  it("returns parsed, validated extraction", async () => {
    const doFetch = vi.fn().mockResolvedValue(gatewayResponse(valid));
    const out = await extractWithLLM("job text", cfg, doFetch);
    expect(out.company_name).toBe("Acme");
    expect(out.skills).toEqual(["TypeScript"]);
  });

  it("throws when the model returns invalid JSON schema", async () => {
    const doFetch = vi.fn().mockResolvedValue(gatewayResponse({ company_name: 123 }));
    await expect(extractWithLLM("job text", cfg, doFetch)).rejects.toThrow();
  });

  it("posts to the gateway chat completions endpoint with the model", async () => {
    const doFetch = vi.fn().mockResolvedValue(gatewayResponse(valid));
    await extractWithLLM("job text", cfg, doFetch);
    const [url, init] = doFetch.mock.calls[0];
    expect(url).toBe("https://gw/openrouter/v1/chat/completions");
    expect(JSON.parse(init.body).model).toBe("test-model");
  });
});
