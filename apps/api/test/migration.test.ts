import { env, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("schema", () => {
  it("creates the split-schema tables and drops the old jobs table", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all<{ name: string }>();
    const names = results.map((r) => r.name);
    for (const t of ["users", "job_postings", "job_entries", "posting_skills", "skills", "events", "api_tokens"]) {
      expect(names).toContain(t);
    }
    expect(names).not.toContain("jobs");
    expect(names).not.toContain("job_skills");
  });
});
