import { Hono } from "hono";
import { cors } from "hono/cors";
import { requireAuth } from "./auth";
import { jobs } from "./routes/jobs";

export interface Env {
  DB: D1Database;
  RAW_BUCKET: R2Bucket;
  BROWSER: Fetcher;
  ALLOWED_ORIGIN: string;
  AI_GATEWAY_URL: string;
  EXTRACTION_MODEL: string;
  CLERK_SECRET_KEY: string;
  OPENROUTER_API_KEY: string;
}

const app = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

app.use("/api/*", async (c, next) =>
  cors({ origin: c.env.ALLOWED_ORIGIN, allowHeaders: ["Authorization", "Content-Type"] })(c, next));

app.get("/api/health", (c) => c.json({ status: "ok" }));
app.use("/api/jobs/*", requireAuth);
app.use("/api/jobs", requireAuth);
app.route("/api/jobs", jobs);

export default app;
