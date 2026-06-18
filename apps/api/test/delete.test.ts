import { env, SELF, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
vi.mock("@clerk/backend", () => ({ verifyToken: async () => ({ data: { sub: "user_test" } }) }));
vi.mock("../src/import", () => ({ runImport: vi.fn().mockResolvedValue(undefined) }));
const auth = { headers: { Authorization: "Bearer t", "content-type": "application/json" } };

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  for (const t of ["events", "posting_skills", "skills", "job_entries", "job_postings", "users"]) await env.DB.prepare(`DELETE FROM ${t}`).run();
});

describe("DELETE /api/jobs/:id", () => {
  it("removes the job and returns 204", async () => {
    const created = await (await SELF.fetch("https://api/api/jobs/import", {
      method: "POST", ...auth, body: JSON.stringify({ url: "https://acme.com/1" }),
    })).json<{ id: string }>();
    const res = await SELF.fetch(`https://api/api/jobs/${created.id}`, { method: "DELETE", ...auth });
    expect(res.status).toBe(204);
    const list = await (await SELF.fetch("https://api/api/jobs", auth)).json<unknown[]>();
    expect(list).toHaveLength(0);
  });
});
