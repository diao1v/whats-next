import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { importRequestSchema, jobUpdateSchema } from "@whats-next/shared";
import type { Env } from "../index";
import { ensureUser, createImportingJob, listJobs, getJob, updateJob, listEvents, deleteJob } from "../db";
import { runImport } from "../import";
import { realFetchDeps } from "../extract/fetcher";
import { extractWithLLM } from "../extract/llm";

type Vars = { userId: string };
export const jobs = new Hono<{ Bindings: Env; Variables: Vars }>();

jobs.post("/import", zValidator("json", importRequestSchema), async (c) => {
  const userId = c.get("userId");
  const { url, pastedText } = c.req.valid("json");
  await ensureUser(c.env.DB, userId, "");
  const job = await createImportingJob(c.env.DB, userId, url);

  c.executionCtx.waitUntil(runImport(c.env.DB, c.env.RAW_BUCKET, userId, job, pastedText ?? null, {
    fetchDeps: realFetchDeps(c.env),
    extract: (text) => extractWithLLM(text, {
      gatewayUrl: c.env.AI_GATEWAY_URL, apiKey: c.env.OPENROUTER_API_KEY, model: c.env.EXTRACTION_MODEL,
    }),
    model: c.env.EXTRACTION_MODEL,
  }));

  return c.json(job, 201);
});

jobs.get("/", async (c) => c.json(await listJobs(c.env.DB, c.get("userId"))));

jobs.get("/:id", async (c) => {
  const job = await getJob(c.env.DB, c.get("userId"), c.req.param("id"));
  return job ? c.json(job) : c.json({ error: "not found" }, 404);
});

jobs.patch("/:id", zValidator("json", jobUpdateSchema), async (c) => {
  const job = await updateJob(c.env.DB, c.get("userId"), c.req.param("id"), c.req.valid("json"));
  return job ? c.json(job) : c.json({ error: "not found" }, 404);
});

jobs.get("/:id/events", async (c) =>
  c.json(await listEvents(c.env.DB, c.get("userId"), c.req.param("id"))));

jobs.delete("/:id", async (c) => {
  const ok = await deleteJob(c.env.DB, c.env.RAW_BUCKET, c.get("userId"), c.req.param("id"));
  return ok ? c.body(null, 204) : c.json({ error: "not found" }, 404);
});
