import { Hono } from "hono";

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

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ status: "ok" }));

export default app;
