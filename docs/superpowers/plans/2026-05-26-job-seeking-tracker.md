# Job-Seeking Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private web app that captures job postings from a pasted URL, extracts structured data with an LLM, and tracks application progress through a fixed pipeline.

**Architecture:** pnpm monorepo, two Cloudflare Workers — `apps/web` (Vite + React SPA, static-assets worker) and `apps/api` (Hono API worker holding D1/R2/AI-Gateway bindings). `packages/shared` holds Zod schemas as the single source of truth. Auth via Clerk bearer tokens; CORS between SPA and API. TDD throughout.

**Tech Stack:** TypeScript, pnpm, Cloudflare Workers + Wrangler, Hono, D1 (SQLite), R2, Cloudflare Browser Rendering, OpenRouter via Cloudflare AI Gateway, Clerk, Vite, React, shadcn/ui, Tailwind, TanStack Query (`5.100.14`), Zustand, Vitest + `@cloudflare/vitest-pool-workers`, Zod.

**Versions are exact-pinned (no `^`/`~`)** per the supply-chain requirement. Verify npm provenance at install.

---

## File Structure

```
seeking/
├── pnpm-workspace.yaml
├── package.json                      # root: scripts, devDeps
├── tsconfig.base.json
├── packages/
│   └── shared/
│       ├── package.json
│       ├── src/
│       │   ├── stages.ts             # stage enum + schema
│       │   ├── extraction.ts         # LLM extraction Zod schema
│       │   ├── job.ts                # Job DTO / API contract types
│       │   └── index.ts
│       └── src/*.test.ts
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   ├── wrangler.toml
│   │   ├── vitest.config.ts
│   │   ├── migrations/0001_init.sql
│   │   ├── src/
│   │   │   ├── index.ts              # Hono app entry + routes + CORS
│   │   │   ├── auth.ts               # Clerk bearer middleware
│   │   │   ├── db.ts                 # D1 repository functions
│   │   │   ├── events.ts             # event logging helpers
│   │   │   ├── extract/
│   │   │   │   ├── readability.ts    # HTML -> clean text (pure)
│   │   │   │   ├── fetcher.ts        # plain fetch + render escalation
│   │   │   │   └── llm.ts            # OpenRouter/AI-Gateway extraction
│   │   │   ├── skills.ts             # slug + skill linking
│   │   │   ├── import.ts             # import pipeline orchestration
│   │   │   └── routes/
│   │   │       ├── jobs.ts           # CRUD + import routes
│   │   └── test/                     # vitest worker-pool tests
│   └── web/
│       ├── package.json
│       ├── vite.config.ts
│       ├── wrangler.toml             # static-assets worker
│       ├── tailwind.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx              # Clerk provider + router + QueryClient
│           ├── lib/api.ts            # fetch client w/ bearer token
│           ├── lib/queries.ts        # TanStack Query hooks
│           ├── store/ui.ts           # Zustand UI state
│           ├── components/ImportBar.tsx
│           ├── components/JobBoard.tsx
│           ├── components/JobDetailDrawer.tsx
│           └── components/ui/        # shadcn components
```

---

# Milestone 1 — Monorepo & Shared Schemas

## Task 1: Scaffold the pnpm monorepo

**Files:**
- Create: `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`

- [ ] **Step 1: Create workspace manifest**

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
  - "apps/*"
```

- [ ] **Step 2: Create root package.json**

`package.json`:
```json
{
  "name": "seeking",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "typescript": "5.7.3",
    "vitest": "3.0.5"
  },
  "packageManager": "pnpm@9.15.0"
}
```

- [ ] **Step 3: Create base tsconfig**

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true
  }
}
```

- [ ] **Step 4: Install and verify**

Run: `pnpm install`
Expected: completes, creates `pnpm-lock.yaml`.

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml package.json tsconfig.base.json pnpm-lock.yaml
git commit -m "chore: scaffold pnpm monorepo"
```

---

## Task 2: Shared stage enum (TDD)

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/stages.ts`, `packages/shared/src/stages.test.ts`

- [ ] **Step 1: Create the package manifest and tsconfig**

`packages/shared/package.json`:
```json
{
  "name": "@seeking/shared",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "zod": "3.24.1" },
  "devDependencies": { "vitest": "3.0.5", "typescript": "5.7.3" }
}
```

`packages/shared/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 2: Write the failing test**

`packages/shared/src/stages.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { STAGES, stageSchema, isStage } from "./stages";

describe("stages", () => {
  it("lists pipeline stages in order", () => {
    expect(STAGES).toEqual([
      "Saved", "Applied", "Phone screen", "Interview", "Offer", "Rejected/Closed",
    ]);
  });
  it("validates a known stage", () => {
    expect(stageSchema.parse("Applied")).toBe("Applied");
  });
  it("rejects an unknown stage", () => {
    expect(() => stageSchema.parse("Hired")).toThrow();
  });
  it("isStage narrows correctly", () => {
    expect(isStage("Offer")).toBe(true);
    expect(isStage("nope")).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @seeking/shared test`
Expected: FAIL — cannot find module `./stages`.

- [ ] **Step 4: Implement stages**

`packages/shared/src/stages.ts`:
```ts
import { z } from "zod";

export const STAGES = [
  "Saved", "Applied", "Phone screen", "Interview", "Offer", "Rejected/Closed",
] as const;

export type Stage = (typeof STAGES)[number];
export const stageSchema = z.enum(STAGES);
export const isStage = (v: unknown): v is Stage =>
  typeof v === "string" && (STAGES as readonly string[]).includes(v);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @seeking/shared test`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): pipeline stage enum"
```

---

## Task 3: Shared extraction schema (TDD)

**Files:**
- Create: `packages/shared/src/extraction.ts`, `packages/shared/src/extraction.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/shared/src/extraction.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { extractionSchema } from "./extraction";

const valid = {
  company_name: "Acme",
  is_agency: false,
  agency_name: null,
  job_title: "Senior Engineer",
  role: "Backend Engineer",
  level: "Senior",
  salary_min: 120000,
  salary_max: 150000,
  salary_currency: "USD",
  salary_period: "year",
  salary_raw_text: "$120k–150k",
  location: "Remote, US",
  is_remote: true,
  skills: ["TypeScript", "Cloudflare Workers"],
  deadline: "2026-06-30",
  apply_url: "https://acme.com/apply",
};

describe("extractionSchema", () => {
  it("parses a complete valid object", () => {
    expect(extractionSchema.parse(valid)).toMatchObject({ company_name: "Acme" });
  });
  it("allows nullable optional fields", () => {
    const out = extractionSchema.parse({ ...valid, salary_min: null, deadline: null, level: null });
    expect(out.salary_min).toBeNull();
  });
  it("rejects a bad salary_period", () => {
    expect(() => extractionSchema.parse({ ...valid, salary_period: "fortnight" })).toThrow();
  });
  it("requires skills to be an array of strings", () => {
    expect(() => extractionSchema.parse({ ...valid, skills: "TypeScript" })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seeking/shared test extraction`
Expected: FAIL — cannot find module `./extraction`.

- [ ] **Step 3: Implement the schema**

`packages/shared/src/extraction.ts`:
```ts
import { z } from "zod";

export const salaryPeriodSchema = z.enum(["year", "month", "day", "hour"]);

export const extractionSchema = z.object({
  company_name: z.string(),
  is_agency: z.boolean(),
  agency_name: z.string().nullable(),
  job_title: z.string(),
  role: z.string(),
  level: z.string().nullable(),
  salary_min: z.number().nullable(),
  salary_max: z.number().nullable(),
  salary_currency: z.string().nullable(),
  salary_period: salaryPeriodSchema.nullable(),
  salary_raw_text: z.string().nullable(),
  location: z.string().nullable(),
  is_remote: z.boolean(),
  skills: z.array(z.string()),
  deadline: z.string().nullable(), // ISO-8601 date
  apply_url: z.string().nullable(),
});

export type Extraction = z.infer<typeof extractionSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seeking/shared test extraction`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/extraction.ts packages/shared/src/extraction.test.ts
git commit -m "feat(shared): LLM extraction schema"
```

---

## Task 4: Shared Job DTO + barrel export

**Files:**
- Create: `packages/shared/src/job.ts`, `packages/shared/src/index.ts`
- Test: `packages/shared/src/job.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/shared/src/job.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { importStatusSchema, jobUpdateSchema } from "./job";

describe("job contracts", () => {
  it("accepts valid import statuses", () => {
    for (const s of ["importing", "needs_paste", "ready", "failed"]) {
      expect(importStatusSchema.parse(s)).toBe(s);
    }
  });
  it("jobUpdateSchema accepts a partial update", () => {
    const out = jobUpdateSchema.parse({ stage: "Applied", applied_date: "2026-05-26" });
    expect(out.stage).toBe("Applied");
  });
  it("jobUpdateSchema rejects unknown stage", () => {
    expect(() => jobUpdateSchema.parse({ stage: "Hired" })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seeking/shared test job`
Expected: FAIL — cannot find module `./job`.

- [ ] **Step 3: Implement DTOs and barrel**

`packages/shared/src/job.ts`:
```ts
import { z } from "zod";
import { stageSchema } from "./stages";

export const importStatusSchema = z.enum(["importing", "needs_paste", "ready", "failed"]);
export type ImportStatus = z.infer<typeof importStatusSchema>;

export const sourceMethodSchema = z.enum(["fetch", "render", "paste"]);
export type SourceMethod = z.infer<typeof sourceMethodSchema>;

/** Fields the user may edit on a job. */
export const jobUpdateSchema = z.object({
  stage: stageSchema.optional(),
  applied_date: z.string().nullable().optional(),
  next_action_at: z.string().nullable().optional(),
  notes: z.string().optional(),
}).strict();
export type JobUpdate = z.infer<typeof jobUpdateSchema>;

export interface Job {
  id: string;
  user_id: string;
  company_name: string;
  is_agency: boolean;
  agency_name: string | null;
  job_title: string;
  role: string;
  level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  salary_raw_text: string | null;
  location: string | null;
  is_remote: boolean;
  deadline: string | null;
  url: string;
  apply_url: string | null;
  source_site: string | null;
  snapshot: string | null;
  raw_content_key: string | null;
  source_method: SourceMethod | null;
  extraction_model: string | null;
  stage: string;
  import_status: ImportStatus;
  applied_date: string | null;
  next_action_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
  skills: string[];
}

export const importRequestSchema = z.object({
  url: z.string().url(),
  pastedText: z.string().optional(),
}).strict();
export type ImportRequest = z.infer<typeof importRequestSchema>;
```

`packages/shared/src/index.ts`:
```ts
export * from "./stages";
export * from "./extraction";
export * from "./job";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seeking/shared test job`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/job.ts packages/shared/src/index.ts packages/shared/src/job.test.ts
git commit -m "feat(shared): job DTO and API contracts"
```

---

# Milestone 2 — API Foundation

## Task 5: Scaffold the API worker

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/wrangler.toml`, `apps/api/vitest.config.ts`, `apps/api/src/index.ts`, `apps/api/test/health.test.ts`

- [ ] **Step 1: Create manifest and config**

`apps/api/package.json`:
```json
{
  "name": "@seeking/api",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "migrate:local": "wrangler d1 migrations apply seeking-db --local",
    "migrate:remote": "wrangler d1 migrations apply seeking-db --remote"
  },
  "dependencies": {
    "@seeking/shared": "workspace:*",
    "hono": "4.6.20",
    "@hono/zod-validator": "0.4.2",
    "@clerk/backend": "1.24.1",
    "zod": "3.24.1",
    "zod-to-json-schema": "3.24.1",
    "linkedom": "0.18.6",
    "@mozilla/readability": "0.5.0",
    "@cloudflare/puppeteer": "0.0.14"
  },
  "devDependencies": {
    "wrangler": "3.107.3",
    "@cloudflare/vitest-pool-workers": "0.6.4",
    "@cloudflare/workers-types": "4.20250121.0",
    "vitest": "3.0.5",
    "typescript": "5.7.3"
  }
}
```

`apps/api/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["@cloudflare/workers-types"] },
  "include": ["src", "test"]
}
```

`apps/api/wrangler.toml`:
```toml
name = "seeking-api"
main = "src/index.ts"
compatibility_date = "2025-01-15"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "seeking-db"
database_id = "PLACEHOLDER_SET_AFTER_d1_create"
migrations_dir = "migrations"

[[r2_buckets]]
binding = "RAW_BUCKET"
bucket_name = "seeking-raw"

[browser]
binding = "BROWSER"

[vars]
ALLOWED_ORIGIN = "http://localhost:5173"
AI_GATEWAY_URL = "https://gateway.ai.cloudflare.com/v1/ACCOUNT/GATEWAY/openrouter"
EXTRACTION_MODEL = "google/gemini-2.0-flash-exp:free"
# Secrets (set via `wrangler secret put`): CLERK_SECRET_KEY, OPENROUTER_API_KEY
```

`apps/api/vitest.config.ts`:
```ts
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          compatibilityFlags: ["nodejs_compat"],
          bindings: { ALLOWED_ORIGIN: "http://localhost:5173" },
        },
      },
    },
  },
});
```

- [ ] **Step 2: Write the failing health test**

`apps/api/test/health.test.ts`:
```ts
import { env, SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("health", () => {
  it("GET /api/health returns ok", async () => {
    const res = await SELF.fetch("https://example.com/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @seeking/api test`
Expected: FAIL — no `src/index.ts` / 404.

- [ ] **Step 4: Implement minimal Hono app**

`apps/api/src/index.ts`:
```ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @seeking/api test`
Expected: PASS.

- [ ] **Step 6: Create the D1 database, then update wrangler.toml**

Run: `cd apps/api && pnpm exec wrangler d1 create seeking-db`
Then paste the printed `database_id` into `wrangler.toml`, replacing `PLACEHOLDER_SET_AFTER_d1_create`.
Run: `pnpm exec wrangler r2 bucket create seeking-raw`

- [ ] **Step 7: Commit**

```bash
git add apps/api
git commit -m "feat(api): scaffold Hono worker with health route"
```

---

## Task 6: D1 schema migration

**Files:**
- Create: `apps/api/migrations/0001_init.sql`
- Test: `apps/api/test/migration.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/api/test/migration.test.ts`:
```ts
import { env, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("schema", () => {
  it("creates the expected tables", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all<{ name: string }>();
    const names = results.map((r) => r.name);
    for (const t of ["users", "jobs", "skills", "job_skills", "events"]) {
      expect(names).toContain(t);
    }
  });

  it("enforces job_skills composite PK", async () => {
    await env.DB.prepare("INSERT INTO users (id, email) VALUES ('u1','a@b.c')").run();
    await env.DB.prepare(
      "INSERT INTO jobs (id, user_id, url, company_name, job_title, role, is_agency, is_remote, stage, import_status, notes) VALUES ('j1','u1','http://x','Acme','Eng','Eng',0,0,'Saved','ready','')"
    ).run();
    await env.DB.prepare("INSERT INTO skills (id, slug, name) VALUES ('s1','react','React')").run();
    await env.DB.prepare("INSERT INTO job_skills (job_id, skill_id, raw_label) VALUES ('j1','s1','ReactJS')").run();
    await expect(
      env.DB.prepare("INSERT INTO job_skills (job_id, skill_id, raw_label) VALUES ('j1','s1','React')").run()
    ).rejects.toThrow();
  });
});
```

Add to `vitest.config.ts` miniflare `bindings` a `TEST_MIGRATIONS` populated from the migrations dir. Update `apps/api/vitest.config.ts`:
```ts
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";
import path from "node:path";

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, "migrations"));
  return {
    test: {
      poolOptions: {
        workers: {
          wrangler: { configPath: "./wrangler.toml" },
          miniflare: {
            compatibilityFlags: ["nodejs_compat"],
            bindings: { ALLOWED_ORIGIN: "http://localhost:5173", TEST_MIGRATIONS: migrations },
          },
        },
      },
    },
  };
});
```
Also add `TEST_MIGRATIONS: D1Migration[]` to the `Env` interface in `src/index.ts` (import the type) — or declare it in a `test/env.d.ts`. Use `test/env.d.ts`:
```ts
import type { D1Migration } from "@cloudflare/vitest-pool-workers/config";
declare module "cloudflare:test" {
  interface ProvidedEnv extends Env { TEST_MIGRATIONS: D1Migration[]; }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seeking/api test migration`
Expected: FAIL — no migrations / tables missing.

- [ ] **Step 3: Write the migration**

`apps/api/migrations/0001_init.sql`:
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,          -- Clerk user id
  email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  company_name TEXT NOT NULL,
  is_agency INTEGER NOT NULL DEFAULT 0,
  agency_name TEXT,
  job_title TEXT NOT NULL,
  role TEXT NOT NULL,
  level TEXT,
  salary_min REAL,
  salary_max REAL,
  salary_currency TEXT,
  salary_period TEXT,
  salary_raw_text TEXT,
  location TEXT,
  is_remote INTEGER NOT NULL DEFAULT 0,
  deadline TEXT,
  url TEXT NOT NULL,
  apply_url TEXT,
  source_site TEXT,
  snapshot TEXT,
  raw_content_key TEXT,
  source_method TEXT,
  extraction_model TEXT,
  stage TEXT NOT NULL DEFAULT 'Saved',
  import_status TEXT NOT NULL DEFAULT 'importing',
  applied_date TEXT,
  next_action_at TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_jobs_user ON jobs(user_id);
CREATE INDEX idx_jobs_user_stage ON jobs(user_id, stage);

CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE job_skills (
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  raw_label TEXT NOT NULL,
  PRIMARY KEY (job_id, skill_id)
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_events_job ON events(job_id);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seeking/api test migration`
Expected: PASS (2 tests).

- [ ] **Step 5: Apply locally and commit**

```bash
cd apps/api && pnpm migrate:local && cd ../..
git add apps/api/migrations apps/api/vitest.config.ts apps/api/test
git commit -m "feat(api): initial D1 schema"
```

---

## Task 7: Clerk bearer auth middleware (TDD)

**Files:**
- Create: `apps/api/src/auth.ts`
- Test: `apps/api/test/auth.test.ts`

- [ ] **Step 1: Write the failing test (with mocked Clerk verify)**

`apps/api/test/auth.test.ts`:
```ts
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
  it("sets userId when token verifies", async () => {
    verifyToken.mockResolvedValue({ sub: "user_123" });
    const res = await makeApp().request("/api/me",
      { headers: { Authorization: "Bearer good" } }, { CLERK_SECRET_KEY: "sk" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: "user_123" });
  });
  it("401s when verification throws", async () => {
    verifyToken.mockRejectedValue(new Error("bad"));
    const res = await makeApp().request("/api/me",
      { headers: { Authorization: "Bearer bad" } }, { CLERK_SECRET_KEY: "sk" });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seeking/api test auth`
Expected: FAIL — cannot find `../src/auth`.

- [ ] **Step 3: Implement the middleware**

`apps/api/src/auth.ts`:
```ts
import { verifyToken } from "@clerk/backend";
import type { MiddlewareHandler } from "hono";
import type { Env } from "./index";

type Vars = { userId: string };

export const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: Vars }> = async (c, next) => {
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return c.json({ error: "unauthorized" }, 401);
  try {
    const claims = await verifyToken(token, { secretKey: c.env.CLERK_SECRET_KEY });
    if (!claims.sub) return c.json({ error: "unauthorized" }, 401);
    c.set("userId", claims.sub);
    await next();
  } catch {
    return c.json({ error: "unauthorized" }, 401);
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seeking/api test auth`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth.ts apps/api/test/auth.test.ts
git commit -m "feat(api): Clerk bearer auth middleware"
```

---

## Task 8: DB repository — users & job creation (TDD)

**Files:**
- Create: `apps/api/src/db.ts`
- Test: `apps/api/test/db.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/api/test/db.test.ts`:
```ts
import { env, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { ensureUser, createImportingJob, getJob, listJobs } from "../src/db";

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM job_skills").run();
  await env.DB.prepare("DELETE FROM jobs").run();
  await env.DB.prepare("DELETE FROM users").run();
});

describe("db repository", () => {
  it("ensureUser is idempotent", async () => {
    await ensureUser(env.DB, "u1", "a@b.c");
    await ensureUser(env.DB, "u1", "a@b.c");
    const { results } = await env.DB.prepare("SELECT COUNT(*) n FROM users").all<{ n: number }>();
    expect(results[0].n).toBe(1);
  });

  it("createImportingJob inserts an importing row scoped to the user", async () => {
    await ensureUser(env.DB, "u1", "a@b.c");
    const job = await createImportingJob(env.DB, "u1", "https://acme.com/jobs/1");
    expect(job.import_status).toBe("importing");
    expect(job.url).toBe("https://acme.com/jobs/1");
    const fetched = await getJob(env.DB, "u1", job.id);
    expect(fetched?.id).toBe(job.id);
  });

  it("listJobs only returns the user's own jobs", async () => {
    await ensureUser(env.DB, "u1", "a@b.c");
    await ensureUser(env.DB, "u2", "x@y.z");
    await createImportingJob(env.DB, "u1", "https://a.com/1");
    await createImportingJob(env.DB, "u2", "https://b.com/2");
    const jobs = await listJobs(env.DB, "u1");
    expect(jobs).toHaveLength(1);
    expect(jobs[0].user_id).toBe("u1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seeking/api test db`
Expected: FAIL — cannot find `../src/db`.

- [ ] **Step 3: Implement the repository (creation + reads)**

`apps/api/src/db.ts`:
```ts
import type { Job } from "@seeking/shared";

const newId = () => crypto.randomUUID();

export async function ensureUser(db: D1Database, id: string, email: string): Promise<void> {
  await db.prepare(
    "INSERT INTO users (id, email) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email"
  ).bind(id, email).run();
}

export async function createImportingJob(db: D1Database, userId: string, url: string): Promise<Job> {
  const id = newId();
  const site = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; } })();
  await db.prepare(
    `INSERT INTO jobs (id, user_id, url, source_site, company_name, job_title, role, import_status)
     VALUES (?, ?, ?, ?, '', '', '', 'importing')`
  ).bind(id, userId, url, site).run();
  const job = await getJob(db, userId, id);
  if (!job) throw new Error("failed to create job");
  return job;
}

export async function getJob(db: D1Database, userId: string, id: string): Promise<Job | null> {
  const row = await db.prepare("SELECT * FROM jobs WHERE id = ? AND user_id = ?").bind(id, userId).first();
  if (!row) return null;
  return hydrate(db, row as Record<string, unknown>);
}

export async function listJobs(db: D1Database, userId: string): Promise<Job[]> {
  const { results } = await db.prepare(
    "SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC"
  ).bind(userId).all();
  return Promise.all(results.map((r) => hydrate(db, r as Record<string, unknown>)));
}

async function hydrate(db: D1Database, row: Record<string, unknown>): Promise<Job> {
  const { results } = await db.prepare(
    "SELECT s.name FROM job_skills js JOIN skills s ON s.id = js.skill_id WHERE js.job_id = ?"
  ).bind(row.id as string).all<{ name: string }>();
  return {
    ...(row as unknown as Job),
    is_agency: Boolean(row.is_agency),
    is_remote: Boolean(row.is_remote),
    skills: results.map((r) => r.name),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seeking/api test db`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db.ts apps/api/test/db.test.ts
git commit -m "feat(api): db repository for users and job creation"
```

---

## Task 9: Events + stage updates in the repository (TDD)

**Files:**
- Modify: `apps/api/src/db.ts`
- Create: `apps/api/src/events.ts`
- Test: `apps/api/test/events.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/api/test/events.test.ts`:
```ts
import { env, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { ensureUser, createImportingJob, updateJob, listEvents } from "../src/db";

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM events").run();
  await env.DB.prepare("DELETE FROM jobs").run();
  await env.DB.prepare("DELETE FROM users").run();
  await ensureUser(env.DB, "u1", "a@b.c");
});

describe("updateJob + events", () => {
  it("changing stage records a status_change event", async () => {
    const job = await createImportingJob(env.DB, "u1", "https://a.com/1");
    await updateJob(env.DB, "u1", job.id, { stage: "Applied" });
    const events = await listEvents(env.DB, "u1", job.id);
    expect(events.some((e) => e.type === "status_change")).toBe(true);
    const sc = events.find((e) => e.type === "status_change")!;
    expect(JSON.parse(sc.payload)).toEqual({ from: "Saved", to: "Applied" });
  });

  it("updates non-stage fields without a status event", async () => {
    const job = await createImportingJob(env.DB, "u1", "https://a.com/1");
    await updateJob(env.DB, "u1", job.id, { notes: "called recruiter" });
    const updated = await env.DB.prepare("SELECT notes FROM jobs WHERE id=?").bind(job.id).first<{ notes: string }>();
    expect(updated?.notes).toBe("called recruiter");
    const events = await listEvents(env.DB, "u1", job.id);
    expect(events.filter((e) => e.type === "status_change")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seeking/api test events`
Expected: FAIL — `updateJob`/`listEvents` not exported.

- [ ] **Step 3: Implement events helper and updateJob**

`apps/api/src/events.ts`:
```ts
export interface EventRow {
  id: string; job_id: string; user_id: string; type: string; payload: string; created_at: string;
}

export async function addEvent(
  db: D1Database, userId: string, jobId: string, type: string, payload: object
): Promise<void> {
  await db.prepare(
    "INSERT INTO events (id, job_id, user_id, type, payload) VALUES (?, ?, ?, ?, ?)"
  ).bind(crypto.randomUUID(), jobId, userId, type, JSON.stringify(payload)).run();
}
```

Add to `apps/api/src/db.ts`:
```ts
import { addEvent, type EventRow } from "./events";
import type { JobUpdate } from "@seeking/shared";

const COLUMN_FOR: Record<keyof JobUpdate, string> = {
  stage: "stage", applied_date: "applied_date", next_action_at: "next_action_at", notes: "notes",
};

export async function updateJob(db: D1Database, userId: string, id: string, patch: JobUpdate): Promise<Job | null> {
  const current = await getJob(db, userId, id);
  if (!current) return null;

  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const key of Object.keys(patch) as (keyof JobUpdate)[]) {
    sets.push(`${COLUMN_FOR[key]} = ?`);
    vals.push(patch[key] ?? null);
  }
  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    vals.push(id, userId);
    await db.prepare(`UPDATE jobs SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`).bind(...vals).run();
  }
  if (patch.stage && patch.stage !== current.stage) {
    await addEvent(db, userId, id, "status_change", { from: current.stage, to: patch.stage });
  }
  return getJob(db, userId, id);
}

export async function listEvents(db: D1Database, userId: string, jobId: string): Promise<EventRow[]> {
  const { results } = await db.prepare(
    "SELECT * FROM events WHERE job_id = ? AND user_id = ? ORDER BY created_at ASC"
  ).bind(jobId, userId).all<EventRow>();
  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seeking/api test events`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db.ts apps/api/src/events.ts apps/api/test/events.test.ts
git commit -m "feat(api): job updates with status-change events"
```

---

# Milestone 3 — Import Pipeline

## Task 10: Readability extraction (TDD, pure function)

**Files:**
- Create: `apps/api/src/extract/readability.ts`
- Test: `apps/api/test/readability.test.ts`, fixtures in `apps/api/test/fixtures/`

- [ ] **Step 1: Add fixtures and write the failing test**

`apps/api/test/fixtures/greenhouse.html` — a saved (trimmed) job page containing an `<article>` with a job description (paste a real example ≥ 600 chars of body text).
`apps/api/test/fixtures/thin.html`:
```html
<!doctype html><html><body><div>Loading…</div></body></html>
```

`apps/api/test/readability.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractReadable, isThin } from "../src/extract/readability";

const fx = (n: string) => readFileSync(join(__dirname, "fixtures", n), "utf8");

describe("extractReadable", () => {
  it("pulls substantial text from a real job page", () => {
    const out = extractReadable(fx("greenhouse.html"), "https://boards.greenhouse.io/x/jobs/1");
    expect(out.text.length).toBeGreaterThan(400);
    expect(isThin(out.text)).toBe(false);
  });
  it("flags a JS-shell page as thin", () => {
    const out = extractReadable(fx("thin.html"), "https://x.com");
    expect(isThin(out.text)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seeking/api test readability`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement extraction**

`apps/api/src/extract/readability.ts`:
```ts
import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";

const THIN_THRESHOLD = 300;

export function extractReadable(html: string, url: string): { title: string; text: string } {
  const { document } = parseHTML(html);
  // Readability expects a document with a base URI; linkedom provides a DOM-like doc.
  const reader = new Readability(document as unknown as Document);
  const article = reader.parse();
  const text = (article?.textContent ?? document.body?.textContent ?? "").replace(/\s+\n/g, "\n").trim();
  return { title: article?.title ?? document.title ?? "", text };
}

export const isThin = (text: string): boolean => text.trim().length < THIN_THRESHOLD;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seeking/api test readability`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/extract/readability.ts apps/api/test/readability.test.ts apps/api/test/fixtures
git commit -m "feat(api): readability text extraction"
```

---

## Task 11: Content fetcher with render escalation (TDD)

**Files:**
- Create: `apps/api/src/extract/fetcher.ts`
- Test: `apps/api/test/fetcher.test.ts`

- [ ] **Step 1: Write the failing test (inject fetch + browser)**

`apps/api/test/fetcher.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { fetchContent } from "../src/extract/fetcher";

const richHtml = `<html><body><article>${"Great role. ".repeat(60)}</article></body></html>`;
const thinHtml = `<html><body><div>Loading…</div></body></html>`;

describe("fetchContent", () => {
  it("returns fetch result when content is rich", async () => {
    const doFetch = vi.fn().mockResolvedValue(new Response(richHtml, { status: 200 }));
    const renderHtml = vi.fn();
    const out = await fetchContent("https://x.com/1", { doFetch, renderHtml });
    expect(out.method).toBe("fetch");
    expect(out.html).toBe(richHtml);
    expect(renderHtml).not.toHaveBeenCalled();
  });

  it("escalates to render when plain fetch is thin", async () => {
    const doFetch = vi.fn().mockResolvedValue(new Response(thinHtml, { status: 200 }));
    const renderHtml = vi.fn().mockResolvedValue(richHtml);
    const out = await fetchContent("https://x.com/1", { doFetch, renderHtml });
    expect(out.method).toBe("render");
    expect(out.html).toBe(richHtml);
  });

  it("returns needs_paste when render is still thin", async () => {
    const doFetch = vi.fn().mockResolvedValue(new Response(thinHtml, { status: 200 }));
    const renderHtml = vi.fn().mockResolvedValue(thinHtml);
    const out = await fetchContent("https://x.com/1", { doFetch, renderHtml });
    expect(out.method).toBe("needs_paste");
  });

  it("escalates to render when fetch fails", async () => {
    const doFetch = vi.fn().mockResolvedValue(new Response("blocked", { status: 403 }));
    const renderHtml = vi.fn().mockResolvedValue(richHtml);
    const out = await fetchContent("https://x.com/1", { doFetch, renderHtml });
    expect(out.method).toBe("render");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seeking/api test fetcher`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the fetcher with injected dependencies**

`apps/api/src/extract/fetcher.ts`:
```ts
import { extractReadable, isThin } from "./readability";

export type FetchMethod = "fetch" | "render" | "needs_paste";

export interface FetchResult { method: FetchMethod; html: string | null; text: string | null; }

export interface FetchDeps {
  doFetch: (url: string) => Promise<Response>;
  renderHtml: (url: string) => Promise<string>;
}

const UA = "Mozilla/5.0 (compatible; SeekingBot/1.0)";

export async function fetchContent(url: string, deps: FetchDeps): Promise<FetchResult> {
  let html: string | null = null;
  const res = await deps.doFetch(url);
  if (res.ok) {
    html = await res.text();
    const { text } = extractReadable(html, url);
    if (!isThin(text)) return { method: "fetch", html, text };
  }
  // escalate to headless render
  const rendered = await deps.renderHtml(url);
  const { text } = extractReadable(rendered, url);
  if (!isThin(text)) return { method: "render", html: rendered, text };
  return { method: "needs_paste", html: rendered ?? html, text: null };
}

/** Real dependencies, built from the worker env. */
export function realFetchDeps(env: { BROWSER: Fetcher }): FetchDeps {
  return {
    doFetch: (url) => fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } }),
    renderHtml: async (url) => {
      const puppeteer = await import("@cloudflare/puppeteer");
      const browser = await puppeteer.launch(env.BROWSER);
      try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "networkidle0", timeout: 20000 });
        return await page.content();
      } finally {
        await browser.close();
      }
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seeking/api test fetcher`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/extract/fetcher.ts apps/api/test/fetcher.test.ts
git commit -m "feat(api): content fetcher with render escalation"
```

---

## Task 12: LLM extraction via AI Gateway (TDD)

**Files:**
- Create: `apps/api/src/extract/llm.ts`
- Test: `apps/api/test/llm.test.ts`

- [ ] **Step 1: Write the failing test (mock fetch to gateway)**

`apps/api/test/llm.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { extractWithLLM } from "../src/extract/llm";

const valid = {
  company_name: "Acme", is_agency: false, agency_name: null, job_title: "Eng", role: "Backend",
  level: "Senior", salary_min: null, salary_max: null, salary_currency: null, salary_period: null,
  salary_raw_text: null, location: "Remote", is_remote: true, skills: ["TypeScript"], deadline: null,
  apply_url: null,
};

function gatewayResponse(obj: unknown) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(obj) } }] }),
    { status: 200, headers: { "content-type": "application/json" } });
}

describe("extractWithLLM", () => {
  const cfg = { gatewayUrl: "https://gw/openrouter", apiKey: "k", model: "test-model" };

  it("returns parsed, validated extraction", async () => {
    const doFetch = vi.fn().mockResolvedValue(gatewayResponse(valid));
    const out = await extractWithLLM("job text", cfg, doFetch);
    expect(out.company_name).toBe("Acme");
    expect(out.skills).toEqual(["TypeScript"]);
  });

  it("throws when the model returns invalid JSON schema", async () => {
    const doFetch = vi.fn().mockResolvedValue(gatewayResponse({ company_name: 123 }));
    await expect(extractWithLLM("job text", cfg, doFetch)).rejects.toThrow();
  });

  it("posts to the gateway chat completions endpoint with the model", async () => {
    const doFetch = vi.fn().mockResolvedValue(gatewayResponse(valid));
    await extractWithLLM("job text", cfg, doFetch);
    const [url, init] = doFetch.mock.calls[0];
    expect(url).toBe("https://gw/openrouter/v1/chat/completions");
    expect(JSON.parse(init.body).model).toBe("test-model");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seeking/api test llm`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the LLM client**

`apps/api/src/extract/llm.ts`:
```ts
import { extractionSchema, type Extraction } from "@seeking/shared";
import { zodToJsonSchema } from "zod-to-json-schema";

export interface LLMConfig { gatewayUrl: string; apiKey: string; model: string; }
export type DoFetch = (url: string, init: RequestInit) => Promise<Response>;

const jsonSchema = zodToJsonSchema(extractionSchema, "extraction");

const SYSTEM = "You extract structured job-posting data. Return ONLY JSON matching the schema. " +
  "Use null for unknown fields. is_agency=true only when the poster is a recruiting agency, " +
  "not the hiring company; then set agency_name.";

export async function extractWithLLM(
  jobText: string, cfg: LLMConfig, doFetch: DoFetch = fetch
): Promise<Extraction> {
  const res = await doFetch(`${cfg.gatewayUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: jobText }],
      response_format: {
        type: "json_schema",
        json_schema: { name: "extraction", strict: true, schema: jsonSchema },
      },
    }),
  });
  if (!res.ok) throw new Error(`LLM error ${res.status}`);
  const data = await res.json<{ choices: { message: { content: string } }[] }>();
  const raw = JSON.parse(data.choices[0].message.content);
  return extractionSchema.parse(raw);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seeking/api test llm`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/extract/llm.ts apps/api/test/llm.test.ts
git commit -m "feat(api): LLM extraction via AI gateway"
```

---

## Task 13: Skill normalization & linking (TDD)

**Files:**
- Create: `apps/api/src/skills.ts`
- Test: `apps/api/test/skills.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/api/test/skills.test.ts`:
```ts
import { env, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { slugifySkill, linkSkills } from "../src/skills";
import { ensureUser, createImportingJob } from "../src/db";

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM job_skills").run();
  await env.DB.prepare("DELETE FROM skills").run();
  await env.DB.prepare("DELETE FROM jobs").run();
  await env.DB.prepare("DELETE FROM users").run();
  await ensureUser(env.DB, "u1", "a@b.c");
});

describe("skills", () => {
  it("slugify converges variants", () => {
    expect(slugifySkill("ReactJS")).toBe(slugifySkill("React JS"));
    expect(slugifySkill("  React  ")).toBe("react");
  });

  it("links skills, reusing existing rows by slug and keeping raw labels", async () => {
    const job = await createImportingJob(env.DB, "u1", "https://a.com/1");
    await linkSkills(env.DB, job.id, ["ReactJS", "TypeScript"]);
    await linkSkills(env.DB, job.id, ["React"]); // same slug as ReactJS
    const { results: skills } = await env.DB.prepare("SELECT slug FROM skills ORDER BY slug").all<{ slug: string }>();
    expect(skills.map((s) => s.slug)).toEqual(["react", "typescript"]);
    const { results: links } = await env.DB.prepare(
      "SELECT raw_label FROM job_skills WHERE job_id = ? ORDER BY raw_label"
    ).bind(job.id).all<{ raw_label: string }>();
    expect(links.map((l) => l.raw_label)).toContain("ReactJS");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seeking/api test skills`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement skill normalization**

`apps/api/src/skills.ts`:
```ts
export function slugifySkill(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

export async function linkSkills(db: D1Database, jobId: string, labels: string[]): Promise<void> {
  for (const label of labels) {
    const slug = slugifySkill(label);
    if (!slug) continue;
    let row = await db.prepare("SELECT id FROM skills WHERE slug = ?").bind(slug).first<{ id: string }>();
    if (!row) {
      const id = crypto.randomUUID();
      await db.prepare("INSERT INTO skills (id, slug, name) VALUES (?, ?, ?)").bind(id, slug, label).run();
      row = { id };
    }
    await db.prepare(
      "INSERT INTO job_skills (job_id, skill_id, raw_label) VALUES (?, ?, ?) ON CONFLICT(job_id, skill_id) DO NOTHING"
    ).bind(jobId, row.id, label).run();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seeking/api test skills`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/skills.ts apps/api/test/skills.test.ts
git commit -m "feat(api): skill normalization and linking"
```

---

## Task 14: Import pipeline orchestration (TDD)

**Files:**
- Create: `apps/api/src/import.ts`
- Modify: `apps/api/src/db.ts` (add `applyExtraction`, `markImportStatus`, `setRawContentKey`)
- Test: `apps/api/test/import.test.ts`

- [ ] **Step 1: Add DB helpers used by the pipeline**

Add to `apps/api/src/db.ts`:
```ts
import { extractionSchema, type Extraction, type ImportStatus, type SourceMethod } from "@seeking/shared";
import { linkSkills } from "./skills";

export async function markImportStatus(db: D1Database, id: string, status: ImportStatus): Promise<void> {
  await db.prepare("UPDATE jobs SET import_status = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(status, id).run();
}

export async function applyExtraction(
  db: D1Database, userId: string, id: string, ex: Extraction, method: SourceMethod, model: string, rawKey: string | null
): Promise<void> {
  await db.prepare(
    `UPDATE jobs SET company_name=?, is_agency=?, agency_name=?, job_title=?, role=?, level=?,
       salary_min=?, salary_max=?, salary_currency=?, salary_period=?, salary_raw_text=?,
       location=?, is_remote=?, deadline=?, apply_url=?, snapshot=?, raw_content_key=?,
       source_method=?, extraction_model=?, stage='Saved', import_status='ready', updated_at=datetime('now')
     WHERE id=? AND user_id=?`
  ).bind(
    ex.company_name, ex.is_agency ? 1 : 0, ex.agency_name, ex.job_title, ex.role, ex.level,
    ex.salary_min, ex.salary_max, ex.salary_currency, ex.salary_period, ex.salary_raw_text,
    ex.location, ex.is_remote ? 1 : 0, ex.deadline, ex.apply_url, null, rawKey,
    method, model, id, userId
  ).run();
  await linkSkills(db, id, ex.skills);
}
```
(Note: `snapshot` text is passed separately below via a small extra update to keep the bind list readable.)
Add:
```ts
export async function setSnapshot(db: D1Database, id: string, text: string): Promise<void> {
  await db.prepare("UPDATE jobs SET snapshot = ? WHERE id = ?").bind(text, id).run();
}
```

- [ ] **Step 2: Write the failing pipeline test**

`apps/api/test/import.test.ts`:
```ts
import { env, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { runImport } from "../src/import";
import { ensureUser, createImportingJob, getJob } from "../src/db";

const richHtml = `<html><body><article>${"Backend role at Acme. ".repeat(50)}</article></body></html>`;
const extraction = {
  company_name: "Acme", is_agency: false, agency_name: null, job_title: "Backend Eng", role: "Backend",
  level: "Senior", salary_min: null, salary_max: null, salary_currency: null, salary_period: null,
  salary_raw_text: null, location: "Remote", is_remote: true, skills: ["TypeScript"], deadline: null, apply_url: null,
};

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  for (const t of ["job_skills", "skills", "events", "jobs", "users"]) {
    await env.DB.prepare(`DELETE FROM ${t}`).run();
  }
  await ensureUser(env.DB, "u1", "a@b.c");
});

describe("runImport", () => {
  it("populates the job and marks it ready on success", async () => {
    const job = await createImportingJob(env.DB, "u1", "https://acme.com/1");
    await runImport(env.DB, env.RAW_BUCKET, "u1", job, null, {
      fetchDeps: { doFetch: vi.fn().mockResolvedValue(new Response(richHtml)), renderHtml: vi.fn() },
      extract: vi.fn().mockResolvedValue(extraction),
      model: "test-model",
    });
    const updated = await getJob(env.DB, "u1", job.id);
    expect(updated?.import_status).toBe("ready");
    expect(updated?.company_name).toBe("Acme");
    expect(updated?.skills).toEqual(["TypeScript"]);
    expect(updated?.source_method).toBe("fetch");
    expect(updated?.raw_content_key).toBeTruthy();
  });

  it("marks needs_paste when content cannot be fetched or rendered", async () => {
    const job = await createImportingJob(env.DB, "u1", "https://walled.com/1");
    const thin = "<html><body>Loading…</body></html>";
    await runImport(env.DB, env.RAW_BUCKET, "u1", job, null, {
      fetchDeps: { doFetch: vi.fn().mockResolvedValue(new Response(thin)), renderHtml: vi.fn().mockResolvedValue(thin) },
      extract: vi.fn(),
      model: "test-model",
    });
    const updated = await getJob(env.DB, "u1", job.id);
    expect(updated?.import_status).toBe("needs_paste");
  });

  it("uses pastedText directly, skipping fetch", async () => {
    const job = await createImportingJob(env.DB, "u1", "https://walled.com/1");
    const extract = vi.fn().mockResolvedValue(extraction);
    await runImport(env.DB, env.RAW_BUCKET, "u1", job, "Pasted job description ".repeat(40), {
      fetchDeps: { doFetch: vi.fn(), renderHtml: vi.fn() },
      extract, model: "test-model",
    });
    const updated = await getJob(env.DB, "u1", job.id);
    expect(updated?.import_status).toBe("ready");
    expect(updated?.source_method).toBe("paste");
  });

  it("marks failed when the LLM throws", async () => {
    const job = await createImportingJob(env.DB, "u1", "https://acme.com/1");
    await runImport(env.DB, env.RAW_BUCKET, "u1", job, null, {
      fetchDeps: { doFetch: vi.fn().mockResolvedValue(new Response(richHtml)), renderHtml: vi.fn() },
      extract: vi.fn().mockRejectedValue(new Error("model down")),
      model: "test-model",
    });
    const updated = await getJob(env.DB, "u1", job.id);
    expect(updated?.import_status).toBe("failed");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @seeking/api test import`
Expected: FAIL — cannot find `../src/import`.

- [ ] **Step 4: Implement the orchestration**

`apps/api/src/import.ts`:
```ts
import type { Extraction, Job, SourceMethod } from "@seeking/shared";
import { extractReadable, isThin } from "./extract/readability";
import { fetchContent, type FetchDeps } from "./extract/fetcher";
import { applyExtraction, markImportStatus, setSnapshot } from "./db";

export interface ImportDeps {
  fetchDeps: FetchDeps;
  extract: (text: string) => Promise<Extraction>;
  model: string;
}

export async function runImport(
  db: D1Database, bucket: R2Bucket, userId: string, job: Job, pastedText: string | null, deps: ImportDeps
): Promise<void> {
  try {
    let text: string;
    let html: string | null;
    let method: SourceMethod;

    if (pastedText && !isThin(pastedText)) {
      text = extractReadable(`<body>${pastedText}</body>`, job.url).text || pastedText;
      html = pastedText;
      method = "paste";
    } else {
      const result = await fetchContent(job.url, deps.fetchDeps);
      if (result.method === "needs_paste" || !result.text) {
        await markImportStatus(db, job.id, "needs_paste");
        return;
      }
      text = result.text;
      html = result.html;
      method = result.method;
    }

    const rawKey = `raw/${job.id}.html`;
    if (html) await bucket.put(rawKey, html);

    const extraction = await deps.extract(text);
    await applyExtraction(db, userId, job.id, extraction, method, deps.model, html ? rawKey : null);
    await setSnapshot(db, job.id, text);
  } catch {
    await markImportStatus(db, job.id, "failed");
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @seeking/api test import`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/import.ts apps/api/src/db.ts apps/api/test/import.test.ts
git commit -m "feat(api): import pipeline orchestration"
```

---

# Milestone 4 — API Routes

## Task 15: Wire routes — import, list, get (TDD, integration via SELF)

**Files:**
- Create: `apps/api/src/routes/jobs.ts`
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/test/routes.test.ts`

- [ ] **Step 1: Write the failing integration test**

`apps/api/test/routes.test.ts`:
```ts
import { env, SELF, applyD1Migrations, fetchMock } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

// Mock Clerk verify so a bearer token resolves to a fixed user.
vi.mock("@clerk/backend", () => ({ verifyToken: async () => ({ sub: "user_test" }) }));

const auth = { headers: { Authorization: "Bearer t", "content-type": "application/json" } };

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  for (const t of ["job_skills", "skills", "events", "jobs", "users"]) {
    await env.DB.prepare(`DELETE FROM ${t}`).run();
  }
});

describe("job routes", () => {
  it("POST /api/jobs/import creates an importing job and returns it", async () => {
    const res = await SELF.fetch("https://api/api/jobs/import", {
      method: "POST", ...auth, body: JSON.stringify({ url: "https://acme.com/1" }),
    });
    expect(res.status).toBe(201);
    const job = await res.json<{ id: string; import_status: string }>();
    expect(job.import_status).toBe("importing");
  });

  it("GET /api/jobs lists the caller's jobs", async () => {
    await SELF.fetch("https://api/api/jobs/import", {
      method: "POST", ...auth, body: JSON.stringify({ url: "https://acme.com/1" }),
    });
    const res = await SELF.fetch("https://api/api/jobs", auth);
    expect(res.status).toBe(200);
    const jobs = await res.json<unknown[]>();
    expect(jobs).toHaveLength(1);
  });

  it("rejects unauthenticated requests", async () => {
    const res = await SELF.fetch("https://api/api/jobs");
    expect(res.status).toBe(401);
  });
});
```

(For these tests the import pipeline runs in the background via `ctx.waitUntil`; the assertions only check the synchronous create + list, so no network mocking of fetch/LLM is required. The status stays `importing` because the background task's fetch is not stubbed here — that path is covered by Task 14.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seeking/api test routes`
Expected: FAIL — routes not mounted (404).

- [ ] **Step 3: Implement the routes**

`apps/api/src/routes/jobs.ts`:
```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { importRequestSchema, jobUpdateSchema } from "@seeking/shared";
import type { Env } from "../index";
import { ensureUser, createImportingJob, listJobs, getJob, updateJob, listEvents } from "../db";
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
```

`apps/api/src/index.ts` (replace the body, keeping the `Env` interface):
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seeking/api test routes`
Expected: PASS (3 tests). Run the full suite: `pnpm --filter @seeking/api test` → all green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes apps/api/src/index.ts apps/api/test/routes.test.ts
git commit -m "feat(api): job import/list/get/update/events routes"
```

---

## Task 16: Delete job + R2 cleanup (TDD)

**Files:**
- Modify: `apps/api/src/db.ts`, `apps/api/src/routes/jobs.ts`
- Test: `apps/api/test/delete.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/api/test/delete.test.ts`:
```ts
import { env, SELF, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
vi.mock("@clerk/backend", () => ({ verifyToken: async () => ({ sub: "user_test" }) }));
const auth = { headers: { Authorization: "Bearer t", "content-type": "application/json" } };

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  for (const t of ["job_skills", "skills", "events", "jobs", "users"]) await env.DB.prepare(`DELETE FROM ${t}`).run();
});

describe("DELETE /api/jobs/:id", () => {
  it("removes the job and returns 204", async () => {
    const created = await (await SELF.fetch("https://api/api/jobs/import", {
      method: "POST", ...auth, body: JSON.stringify({ url: "https://acme.com/1" }),
    })).json<{ id: string }>();
    const res = await SELF.fetch(`https://api/api/jobs/${created.id}`, { method: "DELETE", ...auth });
    expect(res.status).toBe(204);
    const list = await (await SELF.fetch("https://api/api/jobs", auth)).json<unknown[]>();
    expect(list).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seeking/api test delete`
Expected: FAIL — no DELETE route (404/405).

- [ ] **Step 3: Implement delete**

Add to `apps/api/src/db.ts`:
```ts
export async function deleteJob(db: D1Database, bucket: R2Bucket, userId: string, id: string): Promise<boolean> {
  const job = await getJob(db, userId, id);
  if (!job) return false;
  if (job.raw_content_key) await bucket.delete(job.raw_content_key);
  await db.prepare("DELETE FROM jobs WHERE id = ? AND user_id = ?").bind(id, userId).run();
  return true;
}
```
Add to `apps/api/src/routes/jobs.ts`:
```ts
import { deleteJob } from "../db";

jobs.delete("/:id", async (c) => {
  const ok = await deleteJob(c.env.DB, c.env.RAW_BUCKET, c.get("userId"), c.req.param("id"));
  return ok ? c.body(null, 204) : c.json({ error: "not found" }, 404);
});
```
(ON DELETE CASCADE clears `job_skills`/`events`; ensure `PRAGMA foreign_keys=ON` — D1 enforces FKs by default in migrations.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seeking/api test delete`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db.ts apps/api/src/routes/jobs.ts apps/api/test/delete.test.ts
git commit -m "feat(api): delete job with R2 cleanup"
```

---

# Milestone 5 — Frontend SPA

## Task 17: Scaffold the web app (Vite + Tailwind + Clerk + Query)

**Files:**
- Create: `apps/web/package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `tailwind.config.ts`, `postcss.config.js`, `src/main.tsx`, `src/index.css`, `src/App.tsx`, `.env.local`

- [ ] **Step 1: Create manifest and configs**

`apps/web/package.json`:
```json
{
  "name": "@seeking/web",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "wrangler dev",
    "deploy": "pnpm build && wrangler deploy",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@seeking/shared": "workspace:*",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "@clerk/clerk-react": "5.22.1",
    "@tanstack/react-query": "5.100.14",
    "zustand": "5.0.3"
  },
  "devDependencies": {
    "vite": "6.0.7",
    "@vitejs/plugin-react": "4.3.4",
    "typescript": "5.7.3",
    "tailwindcss": "3.4.17",
    "postcss": "8.4.49",
    "autoprefixer": "10.4.20",
    "wrangler": "3.107.3",
    "vitest": "3.0.5",
    "@testing-library/react": "16.1.0",
    "@testing-library/jest-dom": "6.6.3",
    "jsdom": "25.0.1"
  }
}
```

`apps/web/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", globals: true, setupFiles: ["./src/test-setup.ts"] },
});
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "jsx": "react-jsx", "lib": ["ES2022", "DOM", "DOM.Iterable"], "types": ["vitest/globals"] },
  "include": ["src"]
}
```

`apps/web/tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";
export default { content: ["./index.html", "./src/**/*.{ts,tsx}"], theme: { extend: {} }, plugins: [] } satisfies Config;
```

`apps/web/postcss.config.js`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`apps/web/index.html`:
```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Seeking</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>
```

`apps/web/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`apps/web/.env.local`:
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_REPLACE
VITE_API_URL=http://localhost:8787
```

- [ ] **Step 2: Create the test setup and a smoke test**

`apps/web/src/test-setup.ts`:
```ts
import "@testing-library/jest-dom";
```

`apps/web/src/App.tsx`:
```tsx
export function App() {
  return <h1>Seeking</h1>;
}
```

`apps/web/src/App.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { App } from "./App";

it("renders the app title", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Seeking" })).toBeInTheDocument();
});
```

- [ ] **Step 3: Run test to verify it passes (smoke)**

Run: `pnpm --filter @seeking/web test`
Expected: PASS.

- [ ] **Step 4: Wire providers in main.tsx**

`apps/web/src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider, SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import "./index.css";

const queryClient = new QueryClient();
const pubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={pubKey}>
      <QueryClientProvider client={queryClient}>
        <SignedIn><App /></SignedIn>
        <SignedOut><div className="p-8"><SignInButton /></div></SignedOut>
      </QueryClientProvider>
    </ClerkProvider>
  </React.StrictMode>
);
```

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): scaffold Vite SPA with Clerk and Query providers"
```

---

## Task 18: API client + Query hooks (TDD)

**Files:**
- Create: `apps/web/src/lib/api.ts`, `apps/web/src/lib/queries.ts`
- Test: `apps/web/src/lib/api.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/api.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { createApiClient } from "./api";

describe("api client", () => {
  it("attaches bearer token and base url", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    const api = createApiClient({ baseUrl: "http://api", getToken: async () => "tok", fetchImpl: fetchMock });
    await api.listJobs();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api/api/jobs");
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("throws on non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }));
    const api = createApiClient({ baseUrl: "http://api", getToken: async () => "tok", fetchImpl: fetchMock });
    await expect(api.listJobs()).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seeking/web test api`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the client**

`apps/web/src/lib/api.ts`:
```ts
import type { Job, JobUpdate, ImportRequest } from "@seeking/shared";

export interface ApiOptions {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}

export function createApiClient(opts: ApiOptions) {
  const f = opts.fetchImpl ?? fetch;
  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await opts.getToken();
    const res = await f(`${opts.baseUrl}${path}`, {
      ...init,
      headers: { "content-type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }
  return {
    listJobs: () => call<Job[]>("/api/jobs"),
    getJob: (id: string) => call<Job>(`/api/jobs/${id}`),
    importJob: (body: ImportRequest) => call<Job>("/api/jobs/import", { method: "POST", body: JSON.stringify(body) }),
    updateJob: (id: string, patch: JobUpdate) => call<Job>(`/api/jobs/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    deleteJob: (id: string) => call<void>(`/api/jobs/${id}`, { method: "DELETE" }),
  };
}
export type ApiClient = ReturnType<typeof createApiClient>;
```

`apps/web/src/lib/queries.ts`:
```ts
import { useAuth } from "@clerk/clerk-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { createApiClient } from "./api";
import type { JobUpdate, ImportRequest } from "@seeking/shared";

function useApi() {
  const { getToken } = useAuth();
  return useMemo(() => createApiClient({
    baseUrl: import.meta.env.VITE_API_URL as string, getToken: () => getToken(),
  }), [getToken]);
}

export function useJobs() {
  const api = useApi();
  return useQuery({
    queryKey: ["jobs"],
    queryFn: () => api.listJobs(),
    // poll while anything is still importing
    refetchInterval: (q) =>
      (q.state.data ?? []).some((j) => j.import_status === "importing") ? 2000 : false,
  });
}

export function useImportJob() {
  const api = useApi(); const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ImportRequest) => api.importJob(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useUpdateJob() {
  const api = useApi(); const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: JobUpdate }) => api.updateJob(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useDeleteJob() {
  const api = useApi(); const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seeking/web test api`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib
git commit -m "feat(web): api client and TanStack Query hooks"
```

---

## Task 19: UI store + Import bar (TDD)

**Files:**
- Create: `apps/web/src/store/ui.ts`, `apps/web/src/components/ImportBar.tsx`
- Test: `apps/web/src/components/ImportBar.test.tsx`

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/ImportBar.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ImportBar } from "./ImportBar";

describe("ImportBar", () => {
  it("calls onImport with the entered url", () => {
    const onImport = vi.fn();
    render(<ImportBar onImport={onImport} pending={false} />);
    fireEvent.change(screen.getByPlaceholderText(/paste a job url/i), { target: { value: "https://acme.com/1" } });
    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    expect(onImport).toHaveBeenCalledWith("https://acme.com/1");
  });

  it("disables the button while pending", () => {
    render(<ImportBar onImport={vi.fn()} pending={true} />);
    expect(screen.getByRole("button", { name: /adding/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seeking/web test ImportBar`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the store and component**

`apps/web/src/store/ui.ts`:
```ts
import { create } from "zustand";

interface UiState {
  view: "list" | "board";
  selectedJobId: string | null;
  setView: (v: "list" | "board") => void;
  selectJob: (id: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  view: "board",
  selectedJobId: null,
  setView: (view) => set({ view }),
  selectJob: (selectedJobId) => set({ selectedJobId }),
}));
```

`apps/web/src/components/ImportBar.tsx`:
```tsx
import { useState } from "react";

export function ImportBar({ onImport, pending }: { onImport: (url: string) => void; pending: boolean }) {
  const [url, setUrl] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => { e.preventDefault(); if (url.trim()) { onImport(url.trim()); setUrl(""); } }}
    >
      <input
        className="flex-1 rounded border px-3 py-2"
        placeholder="Paste a job URL…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button className="rounded bg-black px-4 py-2 text-white disabled:opacity-50" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seeking/web test ImportBar`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/store apps/web/src/components/ImportBar.tsx apps/web/src/components/ImportBar.test.tsx
git commit -m "feat(web): UI store and import bar"
```

---

## Task 20: Job board with stage columns (TDD)

**Files:**
- Create: `apps/web/src/components/JobBoard.tsx`
- Test: `apps/web/src/components/JobBoard.test.tsx`

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/JobBoard.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { JobBoard } from "./JobBoard";
import type { Job } from "@seeking/shared";

const job = (over: Partial<Job>): Job => ({
  id: "j1", user_id: "u1", company_name: "Acme", is_agency: false, agency_name: null,
  job_title: "Backend Eng", role: "Backend", level: "Senior", salary_min: null, salary_max: null,
  salary_currency: null, salary_period: null, salary_raw_text: null, location: "Remote", is_remote: true,
  deadline: null, url: "https://a.com/1", apply_url: null, source_site: "a.com", snapshot: null,
  raw_content_key: null, source_method: "fetch", extraction_model: "m", stage: "Saved",
  import_status: "ready", applied_date: null, next_action_at: null, notes: "", created_at: "", updated_at: "",
  skills: ["TypeScript"], ...over,
});

describe("JobBoard", () => {
  it("renders a column per stage and places jobs by stage", () => {
    render(<JobBoard jobs={[job({ id: "a", stage: "Saved" }), job({ id: "b", stage: "Applied" })]} onSelect={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Saved" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Applied" })).toBeInTheDocument();
    expect(screen.getByText("Backend Eng", { selector: "*" })).toBeTruthy();
  });

  it("shows an importing badge for jobs still importing", () => {
    render(<JobBoard jobs={[job({ stage: "Saved", import_status: "importing", company_name: "" })]} onSelect={vi.fn()} />);
    expect(screen.getByText(/importing/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seeking/web test JobBoard`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the board**

`apps/web/src/components/JobBoard.tsx`:
```tsx
import { STAGES, type Job, type Stage } from "@seeking/shared";

export function JobBoard({ jobs, onSelect }: { jobs: Job[]; onSelect: (id: string) => void }) {
  const byStage = (s: Stage) => jobs.filter((j) => j.stage === s);
  return (
    <div className="grid grid-cols-6 gap-3">
      {STAGES.map((stage) => (
        <section key={stage} className="rounded bg-gray-50 p-2">
          <h2 className="mb-2 text-sm font-semibold">{stage}</h2>
          <div className="space-y-2">
            {byStage(stage).map((job) => (
              <button
                key={job.id}
                onClick={() => onSelect(job.id)}
                className="w-full rounded border bg-white p-2 text-left text-sm hover:shadow"
              >
                {job.import_status === "importing" ? (
                  <span className="text-gray-400">Importing…</span>
                ) : (
                  <>
                    <div className="font-medium">{job.job_title || "Untitled"}</div>
                    <div className="text-gray-500">{job.company_name}</div>
                    {job.import_status === "needs_paste" && (
                      <div className="mt-1 text-xs text-amber-600">Needs paste</div>
                    )}
                  </>
                )}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seeking/web test JobBoard`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/JobBoard.tsx apps/web/src/components/JobBoard.test.tsx
git commit -m "feat(web): kanban job board"
```

---

## Task 21: Job detail drawer — edit stage/dates/notes, timeline, paste fallback (TDD)

**Files:**
- Create: `apps/web/src/components/JobDetailDrawer.tsx`
- Test: `apps/web/src/components/JobDetailDrawer.test.tsx`

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/JobDetailDrawer.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { JobDetailDrawer } from "./JobDetailDrawer";
import type { Job } from "@seeking/shared";

const baseJob: Job = {
  id: "j1", user_id: "u1", company_name: "Acme", is_agency: false, agency_name: null,
  job_title: "Backend Eng", role: "Backend", level: "Senior", salary_min: 120000, salary_max: 150000,
  salary_currency: "USD", salary_period: "year", salary_raw_text: "$120k-150k", location: "Remote",
  is_remote: true, deadline: null, url: "https://a.com/1", apply_url: "https://a.com/apply",
  source_site: "a.com", snapshot: "Job text", raw_content_key: "raw/j1.html", source_method: "fetch",
  extraction_model: "m", stage: "Saved", import_status: "ready", applied_date: null, next_action_at: null,
  notes: "", created_at: "", updated_at: "", skills: ["TypeScript"],
};

describe("JobDetailDrawer", () => {
  it("changing stage calls onUpdate", () => {
    const onUpdate = vi.fn();
    render(<JobDetailDrawer job={baseJob} onUpdate={onUpdate} onClose={vi.fn()} onPaste={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/stage/i), { target: { value: "Applied" } });
    expect(onUpdate).toHaveBeenCalledWith({ stage: "Applied" });
  });

  it("shows a paste box when import_status is needs_paste", () => {
    const onPaste = vi.fn();
    render(<JobDetailDrawer job={{ ...baseJob, import_status: "needs_paste" }} onUpdate={vi.fn()} onClose={vi.fn()} onPaste={onPaste} />);
    fireEvent.change(screen.getByPlaceholderText(/paste the job description/i), { target: { value: "Full text here" } });
    fireEvent.click(screen.getByRole("button", { name: /extract/i }));
    expect(onPaste).toHaveBeenCalledWith("Full text here");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seeking/web test JobDetailDrawer`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the drawer**

`apps/web/src/components/JobDetailDrawer.tsx`:
```tsx
import { useState } from "react";
import { STAGES, type Job, type JobUpdate } from "@seeking/shared";

export function JobDetailDrawer({
  job, onUpdate, onClose, onPaste,
}: {
  job: Job;
  onUpdate: (patch: JobUpdate) => void;
  onClose: () => void;
  onPaste: (text: string) => void;
}) {
  const [paste, setPaste] = useState("");
  return (
    <aside className="fixed right-0 top-0 h-full w-[28rem] overflow-y-auto border-l bg-white p-4 shadow-xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{job.job_title || "Untitled"}</h2>
        <button onClick={onClose} aria-label="Close">✕</button>
      </div>
      <p className="text-gray-600">{job.company_name}{job.is_agency && job.agency_name ? ` (via ${job.agency_name})` : ""}</p>

      {job.import_status === "needs_paste" && (
        <div className="my-3 rounded border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm">This page couldn't be read automatically. Paste the job description:</p>
          <textarea
            className="mt-2 w-full rounded border p-2 text-sm"
            placeholder="Paste the job description…"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <button className="mt-2 rounded bg-black px-3 py-1 text-sm text-white" onClick={() => onPaste(paste)}>
            Extract
          </button>
        </div>
      )}

      <label className="mt-4 block text-sm font-medium">
        Stage
        <select
          className="mt-1 block w-full rounded border p-2"
          value={job.stage}
          onChange={(e) => onUpdate({ stage: e.target.value as JobUpdate["stage"] })}
        >
          {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>

      <label className="mt-3 block text-sm font-medium">
        Applied date
        <input type="date" className="mt-1 block w-full rounded border p-2"
          value={job.applied_date ?? ""} onChange={(e) => onUpdate({ applied_date: e.target.value || null })} />
      </label>

      <label className="mt-3 block text-sm font-medium">
        Next action
        <input type="datetime-local" className="mt-1 block w-full rounded border p-2"
          value={job.next_action_at ?? ""} onChange={(e) => onUpdate({ next_action_at: e.target.value || null })} />
      </label>

      <label className="mt-3 block text-sm font-medium">
        Notes
        <textarea className="mt-1 block w-full rounded border p-2"
          defaultValue={job.notes} onBlur={(e) => onUpdate({ notes: e.target.value })} />
      </label>

      {job.skills.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium">Skills</h3>
          <div className="mt-1 flex flex-wrap gap-1">
            {job.skills.map((s) => <span key={s} className="rounded bg-gray-100 px-2 py-0.5 text-xs">{s}</span>)}
          </div>
        </div>
      )}

      {job.apply_url && (
        <a className="mt-4 inline-block text-blue-600 underline" href={job.apply_url} target="_blank" rel="noreferrer">
          Apply ↗
        </a>
      )}

      {job.snapshot && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium">Original snapshot</summary>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-600">{job.snapshot}</pre>
        </details>
      )}
    </aside>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seeking/web test JobDetailDrawer`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/JobDetailDrawer.tsx apps/web/src/components/JobDetailDrawer.test.tsx
git commit -m "feat(web): job detail drawer with paste fallback"
```

---

## Task 22: Compose App — wire data, board, drawer, import

**Files:**
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/App.test.tsx` (update)

- [ ] **Step 1: Update the failing test**

`apps/web/src/App.test.tsx` (replace):
```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";

// Mock the query hooks so App renders without Clerk/network.
vi.mock("./lib/queries", () => ({
  useJobs: () => ({ data: [{
    id: "j1", company_name: "Acme", job_title: "Backend Eng", stage: "Saved", import_status: "ready",
    skills: [], is_agency: false, agency_name: null, applied_date: null, next_action_at: null, notes: "",
    apply_url: null, snapshot: null,
  }], isLoading: false }),
  useImportJob: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateJob: () => ({ mutate: vi.fn() }),
  useDeleteJob: () => ({ mutate: vi.fn() }),
}));

it("renders the import bar and the board with a job", () => {
  render(<QueryClientProvider client={new QueryClient()}><App /></QueryClientProvider>);
  expect(screen.getByPlaceholderText(/paste a job url/i)).toBeInTheDocument();
  expect(screen.getByText("Acme")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @seeking/web test App`
Expected: FAIL — App still renders only the heading.

- [ ] **Step 3: Implement App composition**

`apps/web/src/App.tsx`:
```tsx
import { useJobs, useImportJob, useUpdateJob } from "./lib/queries";
import { useUiStore } from "./store/ui";
import { ImportBar } from "./components/ImportBar";
import { JobBoard } from "./components/JobBoard";
import { JobDetailDrawer } from "./components/JobDetailDrawer";

export function App() {
  const { data: jobs = [] } = useJobs();
  const importJob = useImportJob();
  const updateJob = useUpdateJob();
  const selectedId = useUiStore((s) => s.selectedJobId);
  const selectJob = useUiStore((s) => s.selectJob);
  const selected = jobs.find((j) => j.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-7xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Seeking</h1>
      <ImportBar pending={importJob.isPending} onImport={(url) => importJob.mutate({ url })} />
      <div className="mt-6">
        <JobBoard jobs={jobs} onSelect={selectJob} />
      </div>
      {selected && (
        <JobDetailDrawer
          job={selected}
          onClose={() => selectJob(null)}
          onUpdate={(patch) => updateJob.mutate({ id: selected.id, patch })}
          onPaste={(text) => importJob.mutate({ url: selected.url, pastedText: text })}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @seeking/web test App`
Expected: PASS. Run full web suite: `pnpm --filter @seeking/web test` → green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "feat(web): compose dashboard from board, drawer, import"
```

---

# Milestone 6 — Deploy Configuration

## Task 23: Static-assets worker for the SPA

**Files:**
- Create: `apps/web/wrangler.toml`

- [ ] **Step 1: Create the static-assets worker config**

`apps/web/wrangler.toml`:
```toml
name = "seeking-web"
compatibility_date = "2025-01-15"

[assets]
directory = "./dist"
not_found_handling = "single-page-application"
```

- [ ] **Step 2: Build and smoke-test locally**

Run:
```bash
pnpm --filter @seeking/web build
cd apps/web && pnpm exec wrangler dev
```
Expected: serves the built SPA; navigating any path returns `index.html`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/wrangler.toml
git commit -m "chore(web): static-assets worker config"
```

---

## Task 24: Secrets, end-to-end manual verification, and README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Set API secrets**

Run (from `apps/api`):
```bash
pnpm exec wrangler secret put CLERK_SECRET_KEY
pnpm exec wrangler secret put OPENROUTER_API_KEY
```
Set the AI Gateway URL in `wrangler.toml` `[vars] AI_GATEWAY_URL` to your real account/gateway path. Configure the Clerk app's allowed origins to include the deployed web origin.

- [ ] **Step 2: Deploy both workers**

Run:
```bash
pnpm --filter @seeking/api deploy
pnpm --filter @seeking/web deploy
```
Then set `apps/api` `wrangler.toml` `[vars] ALLOWED_ORIGIN` to the deployed web URL and redeploy the API. Set `apps/web/.env.local` `VITE_API_URL` to the deployed API URL before the web build/deploy.

- [ ] **Step 3: Manual end-to-end check**

Sign in via Clerk → paste a real Greenhouse/Lever URL → confirm the card appears as "Importing…", then populates with company/title/skills and lands in **Saved**. Paste a LinkedIn URL → confirm it lands in **needs_paste**, paste the description, confirm it extracts. Move a card to **Applied**, set an applied date, reload, confirm persistence.

- [ ] **Step 4: Write the README**

`README.md` documenting: prerequisites (pnpm, Cloudflare account, Clerk app, OpenRouter key, AI Gateway), `pnpm install`, `pnpm --filter @seeking/api migrate:local`, running `dev` for both apps, the env vars/secrets, and `pnpm -r test`.

- [ ] **Step 5: Commit**

```bash
git add README.md apps/api/wrangler.toml
git commit -m "docs: setup and deploy README"
```

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** capture-by-URL (Tasks 14–15), LLM extraction into schema (Tasks 3, 12), all listed fields incl. agency flag/snapshot/apply_url (Tasks 4, 6, 14), manual status + applied/next dates + notes (Tasks 9, 21), event timeline seam (Task 9), fetch→render→paste fallback (Tasks 10–11, 14, 21), normalized skills (Task 13), raw content in R2 (Task 14), two-worker deploy + CORS + Clerk bearer (Tasks 5, 7, 15, 23), TDD throughout. Phase-2 email and Phase-3 extension intentionally excluded.
- **Readability on Workers:** `linkedom` + `@mozilla/readability` is the assumed combination. If `Readability` rejects the linkedom document type at runtime, fall back to `document.querySelector('article,main,body').textContent` inside `extractReadable` — keep the same function signature and tests.
- **Background import + tests:** the route test (Task 15) asserts only the synchronous create/list; the full pipeline is unit-tested with injected deps (Task 14). Do not assert post-`waitUntil` state in the route test.
- **Pinned versions** may need a same-minor bump if a pin is yanked; keep exact pins and re-verify provenance.
```
