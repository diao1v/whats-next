import { env, SELF, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
vi.mock("@clerk/backend", () => ({ verifyToken: async () => ({ data: { sub: "user_test" } }) }));
const auth = { headers: { Authorization: "Bearer clerk", "content-type": "application/json" } };

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM api_tokens").run();
  await env.DB.prepare("DELETE FROM job_entries").run();
  await env.DB.prepare("DELETE FROM users").run();
});

describe("/api/tokens", () => {
  it("creates a token (plaintext once), lists masked, deletes", async () => {
    const created = await (await SELF.fetch("https://api/api/tokens", {
      method: "POST", ...auth, body: JSON.stringify({ name: "Chrome" }),
    })).json<{ id: string; token: string }>();
    expect(created.token).toMatch(/^wn_/);

    const list = await (await SELF.fetch("https://api/api/tokens", auth)).json<Array<Record<string, unknown>>>();
    expect(list).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain("token_hash");
    expect(JSON.stringify(list)).not.toContain(created.token);

    const del = await SELF.fetch(`https://api/api/tokens/${created.id}`, { method: "DELETE", ...auth });
    expect(del.status).toBe(204);
    expect(await (await SELF.fetch("https://api/api/tokens", auth)).json<unknown[]>()).toHaveLength(0);
  });

  it("rejects unauthenticated", async () => {
    expect((await SELF.fetch("https://api/api/tokens")).status).toBe(401);
  });

  it("a wn_ token authorizes the import endpoint", async () => {
    const created = await (await SELF.fetch("https://api/api/tokens", {
      method: "POST", ...auth, body: JSON.stringify({ name: "x" }),
    })).json<{ token: string }>();
    const res = await SELF.fetch("https://api/api/jobs/import", {
      method: "POST",
      headers: { Authorization: `Bearer ${created.token}`, "content-type": "application/json" },
      body: JSON.stringify({ url: "https://acme.com/1" }),
    });
    expect(res.status).toBe(201);
  });
});
