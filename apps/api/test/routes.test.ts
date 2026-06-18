import { env, SELF, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

// Mock Clerk verify so a bearer token resolves to a fixed user (v3 result shape).
vi.mock("@clerk/backend", () => ({ verifyToken: async () => ({ data: { sub: "user_test" } }) }));
// Keep the background import a no-op so the route test makes no network calls.
vi.mock("../src/import", () => ({ runImport: vi.fn().mockResolvedValue(undefined) }));

const auth = { headers: { Authorization: "Bearer t", "content-type": "application/json" } };

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  for (const t of ["job_skills", "skills", "events", "jobs", "users"]) {
    await env.DB.prepare(`DELETE FROM ${t}`).run();
  }
});

describe("job routes", () => {
  it("POST /api/jobs/import creates an importing job and returns it", async () => {
    const res = await SELF.fetch("https://api/api/jobs/import", {
      method: "POST", ...auth, body: JSON.stringify({ url: "https://acme.com/1" }),
    });
    expect(res.status).toBe(201);
    const job = await res.json<{ id: string; import_status: string }>();
    expect(job.import_status).toBe("importing");
  });

  it("GET /api/jobs lists the caller's jobs", async () => {
    await SELF.fetch("https://api/api/jobs/import", {
      method: "POST", ...auth, body: JSON.stringify({ url: "https://acme.com/1" }),
    });
    const res = await SELF.fetch("https://api/api/jobs", auth);
    expect(res.status).toBe(200);
    const jobs = await res.json<unknown[]>();
    expect(jobs).toHaveLength(1);
  });

  it("rejects unauthenticated requests", async () => {
    const res = await SELF.fetch("https://api/api/jobs");
    expect(res.status).toBe(401);
  });

  it("reflects an allowed CORS origin (parsed from ALLOWED_ORIGIN)", async () => {
    const res = await SELF.fetch("https://api/api/health", {
      headers: { Origin: "http://localhost:5173" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });
});
