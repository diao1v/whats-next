import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "../index";
import { ensureUser } from "../db";
import { createToken, listTokens, revokeToken } from "../tokens";

type Vars = { userId: string };
export const tokens = new Hono<{ Bindings: Env; Variables: Vars }>();

tokens.post("/", zValidator("json", z.object({ name: z.string().optional() }).strict()), async (c) => {
  const userId = c.get("userId");
  await ensureUser(c.env.DB, userId, "");
  const t = await createToken(c.env.DB, userId, c.req.valid("json").name);
  return c.json(t, 201);
});

tokens.get("/", async (c) => c.json(await listTokens(c.env.DB, c.get("userId"))));

tokens.delete("/:id", async (c) => {
  const ok = await revokeToken(c.env.DB, c.get("userId"), c.req.param("id"));
  return ok ? c.body(null, 204) : c.json({ error: "not found" }, 404);
});
