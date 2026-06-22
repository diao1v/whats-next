import { verifyToken } from "@clerk/backend";
import type { MiddlewareHandler, Context } from "hono";
import type { Env } from "./index";
import { findUserByToken, tokenHash } from "./tokens";

type Vars = { userId: string };
type Ctx = { Bindings: Env; Variables: Vars };

function bearer(c: Context<Ctx>): string | null {
  const h = c.req.header("Authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

async function clerkUserId(token: string, secretKey: string): Promise<string | null> {
  try {
    const result = await verifyToken(token, { secretKey });
    const payload = (result as { data?: { sub?: string } }).data ?? (result as { sub?: string });
    return payload?.sub ?? null;
  } catch {
    return null;
  }
}

/** Clerk session only — for routes you manage from the signed-in web app. */
export const requireClerk: MiddlewareHandler<Ctx> = async (c, next) => {
  const token = bearer(c);
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const sub = await clerkUserId(token, c.env.CLERK_SECRET_KEY);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  c.set("userId", sub);
  await next();
};

/** Accepts a `wn_` API token OR a Clerk session — for data routes. */
export const requireAuth: MiddlewareHandler<Ctx> = async (c, next) => {
  const token = bearer(c);
  if (!token) return c.json({ error: "unauthorized" }, 401);
  if (token.startsWith("wn_")) {
    const userId = await findUserByToken(c.env.DB, await tokenHash(token));
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    c.set("userId", userId);
    await next();
    return;
  }
  const sub = await clerkUserId(token, c.env.CLERK_SECRET_KEY);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  c.set("userId", sub);
  await next();
};
