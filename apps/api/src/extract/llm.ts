import { extractionSchema, type Extraction } from "@whats-next/shared";
import { zodToJsonSchema } from "zod-to-json-schema";

export interface LLMConfig { gatewayUrl: string; apiKey: string; model: string; gatewayToken?: string; }
export type DoFetch = (url: string, init: RequestInit) => Promise<Response>;

const jsonSchema = zodToJsonSchema(extractionSchema);

const SYSTEM = "You extract structured job-posting data. Return ONLY JSON matching the schema. " +
  "Use null for unknown fields. is_agency=true only when the poster is a recruiting agency, " +
  "not the hiring company; then set agency_name.";

export async function extractWithLLM(
  jobText: string, cfg: LLMConfig, doFetch: DoFetch = fetch
): Promise<Extraction> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.apiKey}`,
    "content-type": "application/json",
  };
  // When the AI Gateway is in Authenticated mode, this token authorizes use of the gateway itself.
  if (cfg.gatewayToken) headers["cf-aig-authorization"] = `Bearer ${cfg.gatewayToken}`;

  const res = await doFetch(`${cfg.gatewayUrl}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: jobText }],
      response_format: {
        type: "json_schema",
        json_schema: { name: "extraction", strict: true, schema: jsonSchema },
      },
    }),
  });
  if (!res.ok) throw new Error(`LLM error ${res.status}`);
  const data = await res.json<{ choices: { message: { content: string } }[] }>();
  const raw = JSON.parse(data.choices[0].message.content);
  return extractionSchema.parse(raw);
}
