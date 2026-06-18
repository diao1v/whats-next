import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { importRequestSchema, jobUpdateSchema } from "@whats-next/shared";
import type { Env } from "../index";
import {
  ensureUser, createImportingEntry, findEntryByUrl, getEntry, listEntries,
  updateEntry, listEvents, deleteEntry, markImportStatus,
} from "../db";
import { runImport } from "../import";
import { realFetchDeps } from "../extract/fetcher";
import { extractWithLLM } from "../extract/llm";

type Vars = { userId: string };
export const jobs = new Hono<{ Bindings: Env; Variables: Vars }>();

jobs.post("/import", zValidator("json", importRequestSchema), async (c) => {
  const userId = c.get("userId");
  const { url, pastedText } = c.req.valid("json");
  await ensureUser(c.env.DB, userId, "");

  const existing = await findEntryByUrl(c.env.DB, userId, url);
  let entry;
  if (existing) {
    await markImportStatus(c.env.DB, existing.id, "importing");
    entry = (await getEntry(c.env.DB, userId, existing.id))!;
  } else {
    entry = await createImportingEntry(c.env.DB, userId, url);
  }

  const models = c.env.EXTRACTION_MODEL.split(",").map((m) => m.trim()).filter(Boolean);
  c.executionCtx.waitUntil(runImport(c.env.DB, c.env.RAW_BUCKET, userId, entry, pastedText ?? null, {
    fetchDeps: realFetchDeps(c.env),
    extract: (text) => extractWithLLM(text, {
      gatewayUrl: c.env.AI_GATEWAY_URL, apiKey: c.env.OPENROUTER_API_KEY, models,
      gatewayToken: c.env.AI_GATEWAY_TOKEN,
    }),
  }));

  return c.json(entry, 201);
});

jobs.get("/", async (c) => c.json(await listEntries(c.env.DB, c.get("userId"))));

jobs.get("/:id", async (c) => {
  const job = await getEntry(c.env.DB, c.get("userId"), c.req.param("id"));
  return job ? c.json(job) : c.json({ error: "not found" }, 404);
});

jobs.patch("/:id", zValidator("json", jobUpdateSchema), async (c) => {
  const job = await updateEntry(c.env.DB, c.get("userId"), c.req.param("id"), c.req.valid("json"));
  return job ? c.json(job) : c.json({ error: "not found" }, 404);
});

jobs.get("/:id/events", async (c) =>
  c.json(await listEvents(c.env.DB, c.get("userId"), c.req.param("id"))));

jobs.delete("/:id", async (c) => {
  const ok = await deleteEntry(c.env.DB, c.get("userId"), c.req.param("id"));
  return ok ? c.body(null, 204) : c.json({ error: "not found" }, 404);
});
