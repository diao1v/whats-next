import { Hono } from "hono";
import { cors } from "hono/cors";
import { requireAuth, requireClerk } from "./auth";
import { jobs } from "./routes/jobs";
import { tokens } from "./routes/tokens";

export interface Env {
  DB: D1Database;
  RAW_BUCKET: R2Bucket;
  BROWSER: Fetcher;
  ALLOWED_ORIGIN: string;
  AI_GATEWAY_URL: string;
  EXTRACTION_MODEL: string;
  CLERK_SECRET_KEY: string;
  OPENROUTER_API_KEY: string;
  AI_GATEWAY_TOKEN?: string;
}

const app = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

app.use("/api/*", async (c, next) => {
  // ALLOWED_ORIGIN may be a single origin or a comma-separated list (e.g. local + prod).
  const allowed = c.env.ALLOWED_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
  return cors({
    // Allow the configured web origins plus any chrome-extension:// origin (the capture extension).
    origin: (origin) => {
      if (!origin) return allowed[0] ?? null;
      if (origin.startsWith("chrome-extension://")) return origin;
      return allowed.includes(origin) ? origin : (allowed[0] ?? null);
    },
    allowHeaders: ["Authorization", "Content-Type"],
  })(c, next);
});

app.get("/api/health", (c) => c.json({ status: "ok" }));
app.use("/api/jobs/*", requireAuth);
app.use("/api/jobs", requireAuth);
app.route("/api/jobs", jobs);

app.use("/api/tokens/*", requireClerk);
app.use("/api/tokens", requireClerk);
app.route("/api/tokens", tokens);

export default app;
