import { env, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { generateToken, tokenHash, createToken, listTokens, revokeToken, findUserByToken } from "../src/tokens";
import { ensureUser } from "../src/db";

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM api_tokens").run();
  await env.DB.prepare("DELETE FROM users").run();
  await ensureUser(env.DB, "u1", "a@b.c");
});

describe("tokens", () => {
  it("generateToken produces a wn_ prefixed token", () => {
    expect(generateToken()).toMatch(/^wn_[A-Za-z0-9_-]+$/);
  });

  it("createToken returns the plaintext once and stores only its hash", async () => {
    const t = await createToken(env.DB, "u1", "Chrome");
    expect(t.token).toMatch(/^wn_/);
    expect(t.name).toBe("Chrome");
    const row = await env.DB.prepare("SELECT token_hash FROM api_tokens WHERE id=?").bind(t.id).first<{ token_hash: string }>();
    expect(row?.token_hash).toBe(await tokenHash(t.token));
    expect(row?.token_hash).not.toContain(t.token);
  });

  it("findUserByToken resolves a valid token and stamps last_used_at", async () => {
    const t = await createToken(env.DB, "u1", "x");
    expect(await findUserByToken(env.DB, await tokenHash(t.token))).toBe("u1");
    const row = await env.DB.prepare("SELECT last_used_at FROM api_tokens WHERE id=?").bind(t.id).first<{ last_used_at: string | null }>();
    expect(row?.last_used_at).toBeTruthy();
  });

  it("findUserByToken returns null for an unknown hash", async () => {
    expect(await findUserByToken(env.DB, "deadbeef")).toBeNull();
  });

  it("listTokens is masked (no hash, no plaintext)", async () => {
    await createToken(env.DB, "u1", "x");
    const list = await listTokens(env.DB, "u1");
    expect(list).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain("token_hash");
    expect(list[0]).toMatchObject({ name: "x" });
  });

  it("revokeToken deletes only the caller's token", async () => {
    const t = await createToken(env.DB, "u1", "x");
    expect(await revokeToken(env.DB, "u2", t.id)).toBe(false);
    expect(await revokeToken(env.DB, "u1", t.id)).toBe(true);
    expect(await listTokens(env.DB, "u1")).toHaveLength(0);
  });
});
