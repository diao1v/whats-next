import { extractionSchema, type Extraction } from "@whats-next/shared";
import { zodToJsonSchema } from "zod-to-json-schema";

export interface LLMConfig { gatewayUrl: string; apiKey: string; models: string[]; gatewayToken?: string; }
export type DoFetch = (url: string, init: RequestInit) => Promise<Response>;

const jsonSchema = zodToJsonSchema(extractionSchema);

const SYSTEM = "You extract structured job-posting data. Return ONLY JSON matching the schema. " +
  "Use null for unknown fields. is_agency=true only when the poster is a recruiting agency, " +
  "not the hiring company; then set agency_name. Set `salary_currency` to the ISO 4217 code " +
  "matching the posting's country/locale (e.g. NZD for a New Zealand posting, GBP for the UK, " +
  "AUD for Australia); never default to USD — infer from the location, site, or language when the " +
  "currency symbol is ambiguous. Keep salary numbers exactly as written. `level` is the seniority " +
  "and must be one of: junior, mid, senior, staff, principal. Infer it from the job title first, then " +
  "the body — e.g. a title with Senior/Sr. → senior, Staff → staff, Principal/Lead → principal, " +
  "Junior/Graduate/Entry/Associate → junior, Intermediate/Mid → mid. Use null only when there is no " +
  "seniority signal at all. For `description`, write " +
  "a concise 2-4 sentence summary covering the role and its key responsibilities.";

/**
 * Extracts structured job data, trying each configured model in order until one
 * succeeds. Free models are frequently rate-limited (429) upstream, so a fallback
 * list keeps imports resilient. Returns the extraction and the model that produced it.
 */
export async function extractWithLLM(
  jobText: string, cfg: LLMConfig, doFetch: DoFetch = fetch
): Promise<{ extraction: Extraction; model: string }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.apiKey}`,
    "content-type": "application/json",
  };
  // When the AI Gateway is in Authenticated mode, this token authorizes use of the gateway itself.
  if (cfg.gatewayToken) headers["cf-aig-authorization"] = `Bearer ${cfg.gatewayToken}`;

  let lastError: Error | null = null;
  for (const model of cfg.models) {
    try {
      const res = await doFetch(`${cfg.gatewayUrl}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: SYSTEM }, { role: "user", content: jobText }],
          response_format: {
            type: "json_schema",
            json_schema: { name: "extraction", strict: true, schema: jsonSchema },
          },
        }),
      });
      if (!res.ok) {
        lastError = new Error(`LLM error ${res.status} (model ${model})`);
        continue;
      }
      const data = await res.json<{ choices: { message: { content: string } }[] }>();
      const raw = JSON.parse(data.choices[0].message.content);
      return { extraction: extractionSchema.parse(raw), model };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError ?? new Error("LLM extraction failed: no models configured");
}
