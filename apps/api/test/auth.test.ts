import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const verifyToken = vi.fn();
vi.mock("@clerk/backend", () => ({ verifyToken: (...a: unknown[]) => verifyToken(...a) }));

import { requireAuth } from "../src/auth";

function makeApp() {
  const app = new Hono<any>();
  app.use("/api/*", requireAuth);
  app.get("/api/me", (c) => c.json({ userId: c.get("userId") }));
  return app;
}

beforeEach(() => verifyToken.mockReset());

describe("requireAuth", () => {
  it("401s without a bearer token", async () => {
    const res = await makeApp().request("/api/me", {}, { CLERK_SECRET_KEY: "sk" });
    expect(res.status).toBe(401);
  });
  it("sets userId when verifyToken resolves to the payload directly (v3 shape)", async () => {
    verifyToken.mockResolvedValue({ sub: "user_123" });
    const res = await makeApp().request("/api/me",
      { headers: { Authorization: "Bearer good" } }, { CLERK_SECRET_KEY: "sk" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: "user_123" });
  });
  it("also accepts the wrapped { data } shape", async () => {
    verifyToken.mockResolvedValue({ data: { sub: "user_123" } });
    const res = await makeApp().request("/api/me",
      { headers: { Authorization: "Bearer good" } }, { CLERK_SECRET_KEY: "sk" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: "user_123" });
  });
  it("401s when verification returns errors", async () => {
    verifyToken.mockResolvedValue({ errors: [{ message: "bad" }] });
    const res = await makeApp().request("/api/me",
      { headers: { Authorization: "Bearer bad" } }, { CLERK_SECRET_KEY: "sk" });
    expect(res.status).toBe(401);
  });
  it("401s when the result has no subject", async () => {
    verifyToken.mockResolvedValue({ data: {} });
    const res = await makeApp().request("/api/me",
      { headers: { Authorization: "Bearer weird" } }, { CLERK_SECRET_KEY: "sk" });
    expect(res.status).toBe(401);
  });
});
