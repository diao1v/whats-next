import { verifyToken } from "@clerk/backend";
import type { MiddlewareHandler } from "hono";
import type { Env } from "./index";

type Vars = { userId: string };

export const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: Vars }> = async (c, next) => {
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return c.json({ error: "unauthorized" }, 401);
  try {
    // @clerk/backend v3 `verifyToken` resolves to the JWT payload (with `sub`) and
    // throws on an invalid token. Older/mocked shapes wrap it as `{ data }`, so accept both.
    const result = await verifyToken(token, { secretKey: c.env.CLERK_SECRET_KEY });
    const payload = (result as { data?: { sub?: string } }).data ?? (result as { sub?: string });
    const sub = payload?.sub;
    if (!sub) return c.json({ error: "unauthorized" }, 401);
    c.set("userId", sub);
    await next();
  } catch (_e) {
    return c.json({ error: "unauthorized" }, 401);
  }
};
