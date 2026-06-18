# Shared Job Cache & Cross-User Dedup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split job storage into shared `job_postings` (deduped by content hash, incl. an LLM `description`) and per-user `job_entries`, so identical postings are extracted once and shared, while each user keeps private tracking.

**Architecture:** The flat `Job` DTO is preserved — the API composes it by joining a user's `job_entries` row to its shared `job_postings` row. Import fetches content, hashes the cleaned text, reuses an existing posting on a hit (no LLM) or creates one on a miss. Reset migration replaces the single `jobs` table.

**Tech Stack:** TypeScript, Cloudflare Workers/D1/R2, Hono, Zod, Vitest + `@cloudflare/vitest-pool-workers`, React.

**Spec:** `docs/superpowers/specs/2026-06-19-shared-job-cache-design.md`

---

## File Structure

```
packages/shared/src/
  extraction.ts        # + description field
  job.ts               # + description on Job DTO
apps/api/
  migrations/0002_shared_cache.sql   # NEW: reset to split schema
  src/
    extract/hash.ts    # NEW: contentHash (SHA-256)
    extract/llm.ts     # system prompt asks for description
    db.ts              # rewritten: postings + entries repositories
    skills.ts          # linkSkills -> linkPostingSkills (posting_skills)
    events.ts          # entry-scoped
    import.ts          # cache flow: find-or-create posting, link/collapse/refresh
    routes/jobs.ts     # entry-scoped calls (surface unchanged)
apps/web/src/components/
    JobDetailDrawer.tsx # render description above snapshot
```

---

# Milestone 1 — Shared schema: description field

## Task 1: Add `description` to the extraction schema

**Files:**
- Modify: `packages/shared/src/extraction.ts`
- Test: `packages/shared/src/extraction.test.ts`

- [ ] **Step 1: Add a failing test**

Append inside the `describe("extractionSchema", ...)` block in `packages/shared/src/extraction.test.ts`:
```ts
  it("accepts a nullable description", () => {
    expect(extractionSchema.parse({ ...valid, description: "A backend role." }).description).toBe("A backend role.");
    expect(extractionSchema.parse({ ...valid, description: null }).description).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @whats-next/shared test extraction`
Expected: FAIL — `description` is stripped/undefined (not in schema).

- [ ] **Step 3: Add the field**

In `packages/shared/src/extraction.ts`, add this line to the `extractionSchema` object (after `apply_url`):
```ts
  description: z.string().nullable(),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @whats-next/shared test extraction`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/extraction.ts packages/shared/src/extraction.test.ts
git commit -m "feat(shared): add description to extraction schema"
```

## Task 2: Add `description` to the Job DTO

**Files:**
- Modify: `packages/shared/src/job.ts`

- [ ] **Step 1: Add the field**

In `packages/shared/src/job.ts`, add to the `Job` interface immediately after `snapshot: string | null;`:
```ts
  description: string | null;
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @whats-next/shared typecheck`
Expected: PASS (no implementation depends on it yet).

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/job.ts
git commit -m "feat(shared): add description to Job DTO"
```

---

# Milestone 2 — Database: reset to split schema

## Task 3: Reset migration

**Files:**
- Create: `apps/api/migrations/0002_shared_cache.sql`
- Modify: `apps/api/test/migration.test.ts`

- [ ] **Step 1: Update the migration test**

Replace the body of the first test in `apps/api/test/migration.test.ts` (the "creates the expected tables" test) with:
```ts
  it("creates the split-schema tables and drops the old jobs table", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all<{ name: string }>();
    const names = results.map((r) => r.name);
    for (const t of ["users", "job_postings", "job_entries", "posting_skills", "skills", "events"]) {
      expect(names).toContain(t);
    }
    expect(names).not.toContain("jobs");
    expect(names).not.toContain("job_skills");
  });
```
Then **delete** the second test in that file (`"enforces job_skills composite PK"`) — that table no longer exists.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @whats-next/api test migration`
Expected: FAIL — `jobs` still present, `job_postings` absent.

- [ ] **Step 3: Write the migration**

`apps/api/migrations/0002_shared_cache.sql`:
```sql
-- Reset job storage to the shared-posting + per-user-entry split.
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS job_skills;
DROP TABLE IF EXISTS jobs;

CREATE TABLE job_postings (
  id TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL DEFAULT '',
  is_agency INTEGER NOT NULL DEFAULT 0,
  agency_name TEXT,
  job_title TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  level TEXT,
  salary_min REAL,
  salary_max REAL,
  salary_currency TEXT,
  salary_period TEXT,
  salary_raw_text TEXT,
  location TEXT,
  is_remote INTEGER NOT NULL DEFAULT 0,
  deadline TEXT,
  apply_url TEXT,
  source_site TEXT,
  description TEXT,
  snapshot TEXT,
  raw_content_key TEXT,
  source_method TEXT,
  extraction_model TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE job_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  submitted_url TEXT NOT NULL,
  posting_id TEXT REFERENCES job_postings(id),
  import_status TEXT NOT NULL DEFAULT 'importing',
  stage TEXT NOT NULL DEFAULT 'Saved',
  applied_date TEXT,
  next_action_at TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, posting_id)
);
CREATE INDEX idx_entries_user ON job_entries(user_id);
CREATE INDEX idx_entries_user_stage ON job_entries(user_id, stage);

CREATE TABLE posting_skills (
  posting_id TEXT NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  raw_label TEXT NOT NULL,
  PRIMARY KEY (posting_id, skill_id)
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES job_entries(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_events_entry ON events(entry_id);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @whats-next/api test migration`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add apps/api/migrations/0002_shared_cache.sql apps/api/test/migration.test.ts
git commit -m "feat(api): reset migration for shared-cache split schema"
```

---

# Milestone 3 — Content hash

## Task 4: SHA-256 content hash helper

**Files:**
- Create: `apps/api/src/extract/hash.ts`
- Test: `apps/api/test/hash.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/api/test/hash.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { contentHash } from "../src/extract/hash";

describe("contentHash", () => {
  it("is deterministic for identical input", async () => {
    expect(await contentHash("hello world")).toBe(await contentHash("hello world"));
  });
  it("differs for different input", async () => {
    expect(await contentHash("a")).not.toBe(await contentHash("b"));
  });
  it("returns a 64-char hex SHA-256 digest", async () => {
    expect(await contentHash("x")).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @whats-next/api test hash`
Expected: FAIL — cannot find module `../src/extract/hash`.

- [ ] **Step 3: Implement**

`apps/api/src/extract/hash.ts`:
```ts
export async function contentHash(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @whats-next/api test hash`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/extract/hash.ts apps/api/test/hash.test.ts
git commit -m "feat(api): SHA-256 content hash helper"
```

---

# Milestone 4 — Repositories

## Task 5: Posting-scoped skills

**Files:**
- Modify: `apps/api/src/skills.ts`
- Test: `apps/api/test/skills.test.ts`

- [ ] **Step 1: Update the test to posting scope**

Replace the whole body of `apps/api/test/skills.test.ts` with:
```ts
import { env, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { slugifySkill, linkPostingSkills } from "../src/skills";

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM posting_skills").run();
  await env.DB.prepare("DELETE FROM skills").run();
  await env.DB.prepare("DELETE FROM job_postings").run();
  await env.DB.prepare(
    "INSERT INTO job_postings (id, content_hash) VALUES ('p1','h1')"
  ).run();
});

describe("skills", () => {
  it("slugify converges variants", () => {
    expect(slugifySkill("React JS")).toBe(slugifySkill("react js"));
    expect(slugifySkill("  React  ")).toBe("react");
  });

  it("links skills to a posting, reusing rows by slug and keeping raw labels", async () => {
    await linkPostingSkills(env.DB, "p1", ["React", "TypeScript"]);
    await linkPostingSkills(env.DB, "p1", ["  react  "]);
    const { results: skills } = await env.DB.prepare("SELECT slug FROM skills ORDER BY slug").all<{ slug: string }>();
    expect(skills.map((s) => s.slug)).toEqual(["react", "typescript"]);
    const { results: links } = await env.DB.prepare(
      "SELECT raw_label FROM posting_skills WHERE posting_id = ? ORDER BY raw_label"
    ).bind("p1").all<{ raw_label: string }>();
    expect(links.map((l) => l.raw_label)).toContain("React");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @whats-next/api test skills.test`
Expected: FAIL — `linkPostingSkills` not exported.

- [ ] **Step 3: Rename/retarget the function**

Replace `apps/api/src/skills.ts` with:
```ts
export function slugifySkill(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

export async function linkPostingSkills(db: D1Database, postingId: string, labels: string[]): Promise<void> {
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
      "INSERT INTO posting_skills (posting_id, skill_id, raw_label) VALUES (?, ?, ?) ON CONFLICT(posting_id, skill_id) DO NOTHING"
    ).bind(postingId, row.id, label).run();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @whats-next/api test skills.test`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/skills.ts apps/api/test/skills.test.ts
git commit -m "feat(api): posting-scoped skill linking"
```

## Task 6: Entry-scoped events

**Files:**
- Modify: `apps/api/src/events.ts`

- [ ] **Step 1: Retarget events to entries**

Replace `apps/api/src/events.ts` with:
```ts
export interface EventRow {
  id: string; entry_id: string; user_id: string; type: string; payload: string; created_at: string;
}

export async function addEvent(
  db: D1Database, userId: string, entryId: string, type: string, payload: object
): Promise<void> {
  await db.prepare(
    "INSERT INTO events (id, entry_id, user_id, type, payload) VALUES (?, ?, ?, ?, ?)"
  ).bind(crypto.randomUUID(), entryId, userId, type, JSON.stringify(payload)).run();
}
```

- [ ] **Step 2: Commit** (compiles after Task 7; events has no own test file)

```bash
git add apps/api/src/events.ts
git commit -m "feat(api): entry-scoped events"
```

## Task 7: Rewrite the repository (postings + entries)

**Files:**
- Modify: `apps/api/src/db.ts`
- Test: `apps/api/test/db.test.ts`

- [ ] **Step 1: Rewrite the repository test**

Replace the whole `apps/api/test/db.test.ts` with:
```ts
import { env, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  ensureUser, createImportingEntry, findEntryByUrl, getEntry, listEntries,
  findPostingByHash, createPosting, linkEntryToPosting, type PostingInput,
} from "../src/db";

const ex: PostingInput = {
  hash: "h1", company_name: "Acme", is_agency: false, agency_name: null, job_title: "Backend Eng",
  role: "Backend", level: "Senior", salary_min: null, salary_max: null, salary_currency: null,
  salary_period: null, salary_raw_text: null, location: "Remote", is_remote: true, deadline: null,
  apply_url: null, source_site: "acme.com", description: "Build things.", snapshot: "full text",
  skills: ["TypeScript"], method: "fetch", model: "m", rawKey: "raw/h1.html",
};

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  for (const t of ["events", "posting_skills", "skills", "job_entries", "job_postings", "users"]) {
    await env.DB.prepare(`DELETE FROM ${t}`).run();
  }
  await ensureUser(env.DB, "u1", "a@b.c");
});

describe("entries", () => {
  it("createImportingEntry inserts an importing entry and getEntry returns flat Job", async () => {
    const entry = await createImportingEntry(env.DB, "u1", "https://acme.com/1");
    expect(entry.import_status).toBe("importing");
    expect(entry.url).toBe("https://acme.com/1");
    expect(entry.company_name).toBe("");
    expect((await getEntry(env.DB, "u1", entry.id))?.id).toBe(entry.id);
  });

  it("listEntries returns only the caller's entries", async () => {
    await ensureUser(env.DB, "u2", "x@y.z");
    await createImportingEntry(env.DB, "u1", "https://a.com/1");
    await createImportingEntry(env.DB, "u2", "https://b.com/2");
    const list = await listEntries(env.DB, "u1");
    expect(list).toHaveLength(1);
    expect(list[0].user_id).toBe("u1");
  });

  it("findEntryByUrl finds the caller's entry by exact url", async () => {
    const e = await createImportingEntry(env.DB, "u1", "https://a.com/1");
    expect((await findEntryByUrl(env.DB, "u1", "https://a.com/1"))?.id).toBe(e.id);
    expect(await findEntryByUrl(env.DB, "u1", "https://other.com")).toBeNull();
  });
});

describe("postings", () => {
  it("createPosting then findPostingByHash returns the posting; getEntry joins its fields", async () => {
    const entry = await createImportingEntry(env.DB, "u1", "https://acme.com/1");
    const postingId = await createPosting(env.DB, ex);
    expect((await findPostingByHash(env.DB, "h1"))?.id).toBe(postingId);

    await linkEntryToPosting(env.DB, "u1", entry.id, postingId);
    const joined = await getEntry(env.DB, "u1", entry.id);
    expect(joined?.import_status).toBe("ready");
    expect(joined?.company_name).toBe("Acme");
    expect(joined?.description).toBe("Build things.");
    expect(joined?.skills).toEqual(["TypeScript"]);
  });

  it("createPosting is idempotent on content_hash (concurrent race)", async () => {
    const id1 = await createPosting(env.DB, ex);
    const id2 = await createPosting(env.DB, ex);
    expect(id2).toBe(id1);
    const { results } = await env.DB.prepare("SELECT COUNT(*) n FROM job_postings").all<{ n: number }>();
    expect(results[0].n).toBe(1);
  });

  it("linkEntryToPosting collapses a duplicate to a single entry per user+posting", async () => {
    const a = await createImportingEntry(env.DB, "u1", "https://acme.com/1");
    const b = await createImportingEntry(env.DB, "u1", "https://acme.com/2"); // same job, different url
    const postingId = await createPosting(env.DB, ex);
    const survivorA = await linkEntryToPosting(env.DB, "u1", a.id, postingId);
    const survivorB = await linkEntryToPosting(env.DB, "u1", b.id, postingId);
    expect(survivorA).toBe(a.id);
    expect(survivorB).toBe(a.id); // collapsed onto the first
    expect(await getEntry(env.DB, "u1", b.id)).toBeNull();
    expect(await listEntries(env.DB, "u1")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @whats-next/api test db.test`
Expected: FAIL — new exports missing.

- [ ] **Step 3: Rewrite `apps/api/src/db.ts`**

Replace the entire file with:
```ts
import type { Job, JobUpdate, Extraction, ImportStatus, SourceMethod } from "@whats-next/shared";
import { addEvent, type EventRow } from "./events";
import { linkPostingSkills } from "./skills";

const newId = () => crypto.randomUUID();

const COLUMN_FOR: Record<keyof JobUpdate, string> = {
  stage: "stage", applied_date: "applied_date", next_action_at: "next_action_at", notes: "notes",
};

export interface PostingInput extends Extraction {
  hash: string;
  snapshot: string;
  method: SourceMethod;
  model: string;
  rawKey: string | null;
}

export async function ensureUser(db: D1Database, id: string, email: string): Promise<void> {
  await db.prepare(
    "INSERT INTO users (id, email) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email"
  ).bind(id, email).run();
}

// ---- entries -------------------------------------------------------------

export async function createImportingEntry(db: D1Database, userId: string, url: string): Promise<Job> {
  const id = newId();
  await db.prepare(
    "INSERT INTO job_entries (id, user_id, submitted_url, import_status) VALUES (?, ?, ?, 'importing')"
  ).bind(id, userId, url).run();
  const entry = await getEntry(db, userId, id);
  if (!entry) throw new Error("failed to create entry");
  return entry;
}

export async function findEntryByUrl(
  db: D1Database, userId: string, url: string
): Promise<{ id: string; posting_id: string | null } | null> {
  const row = await db.prepare(
    "SELECT id, posting_id FROM job_entries WHERE user_id = ? AND submitted_url = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(userId, url).first<{ id: string; posting_id: string | null }>();
  return row ?? null;
}

export async function getEntry(db: D1Database, userId: string, id: string): Promise<Job | null> {
  // Entry columns listed LAST so that on name collisions (id, created_at) the entry's
  // values win, and remain correct when the LEFT JOIN finds no posting.
  const row = await db.prepare(
    `SELECT p.*, e.*, e.id AS entry_id
       FROM job_entries e LEFT JOIN job_postings p ON p.id = e.posting_id
      WHERE e.id = ? AND e.user_id = ?`
  ).bind(id, userId).first<Record<string, unknown>>();
  if (!row) return null;
  return hydrate(db, row);
}

export async function listEntries(db: D1Database, userId: string): Promise<Job[]> {
  const { results } = await db.prepare(
    `SELECT p.*, e.*, e.id AS entry_id
       FROM job_entries e LEFT JOIN job_postings p ON p.id = e.posting_id
      WHERE e.user_id = ? ORDER BY e.created_at DESC`
  ).bind(userId).all<Record<string, unknown>>();
  return Promise.all(results.map((r) => hydrate(db, r)));
}

export async function updateEntry(db: D1Database, userId: string, id: string, patch: JobUpdate): Promise<Job | null> {
  const current = await getEntry(db, userId, id);
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
    await db.prepare(`UPDATE job_entries SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`).bind(...vals).run();
  }
  if (patch.stage && patch.stage !== current.stage) {
    await addEvent(db, userId, id, "status_change", { from: current.stage, to: patch.stage });
  }
  return getEntry(db, userId, id);
}

export async function markImportStatus(db: D1Database, entryId: string, status: ImportStatus): Promise<void> {
  await db.prepare("UPDATE job_entries SET import_status = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(status, entryId).run();
}

export async function deleteEntry(db: D1Database, userId: string, id: string): Promise<boolean> {
  const entry = await getEntry(db, userId, id);
  if (!entry) return false;
  // Shared posting and its R2 raw are intentionally left intact for other users.
  await db.prepare("DELETE FROM job_entries WHERE id = ? AND user_id = ?").bind(id, userId).run();
  return true;
}

/**
 * Point an entry at a posting and mark it ready. If the user already has a *different*
 * entry for this posting, collapse onto that one (delete this entry). Returns the id of
 * the surviving entry.
 */
export async function linkEntryToPosting(
  db: D1Database, userId: string, entryId: string, postingId: string
): Promise<string> {
  const existing = await db.prepare(
    "SELECT id FROM job_entries WHERE user_id = ? AND posting_id = ? AND id != ? LIMIT 1"
  ).bind(userId, postingId, entryId).first<{ id: string }>();
  if (existing) {
    await db.prepare("DELETE FROM job_entries WHERE id = ? AND user_id = ?").bind(entryId, userId).run();
    return existing.id;
  }
  await db.prepare(
    "UPDATE job_entries SET posting_id = ?, import_status = 'ready', updated_at = datetime('now') WHERE id = ? AND user_id = ?"
  ).bind(postingId, entryId, userId).run();
  return entryId;
}

// ---- postings ------------------------------------------------------------

export async function findPostingByHash(db: D1Database, hash: string): Promise<{ id: string } | null> {
  const row = await db.prepare("SELECT id FROM job_postings WHERE content_hash = ?").bind(hash).first<{ id: string }>();
  return row ?? null;
}

export async function createPosting(db: D1Database, p: PostingInput): Promise<string> {
  const id = newId();
  await db.prepare(
    `INSERT INTO job_postings (id, content_hash, company_name, is_agency, agency_name, job_title, role, level,
       salary_min, salary_max, salary_currency, salary_period, salary_raw_text, location, is_remote, deadline,
       apply_url, source_site, description, snapshot, raw_content_key, source_method, extraction_model)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(content_hash) DO NOTHING`
  ).bind(
    id, p.hash, p.company_name, p.is_agency ? 1 : 0, p.agency_name, p.job_title, p.role, p.level,
    p.salary_min, p.salary_max, p.salary_currency, p.salary_period, p.salary_raw_text, p.location,
    p.is_remote ? 1 : 0, p.deadline, p.apply_url, p.source_site, p.description, p.snapshot, p.rawKey,
    p.method, p.model
  ).run();
  const row = await db.prepare("SELECT id FROM job_postings WHERE content_hash = ?").bind(p.hash).first<{ id: string }>();
  const postingId = row!.id;
  await linkPostingSkills(db, postingId, p.skills);
  return postingId;
}

// ---- events --------------------------------------------------------------

export async function listEvents(db: D1Database, userId: string, entryId: string): Promise<EventRow[]> {
  const { results } = await db.prepare(
    "SELECT * FROM events WHERE entry_id = ? AND user_id = ? ORDER BY created_at ASC"
  ).bind(entryId, userId).all<EventRow>();
  return results;
}

// ---- mapping -------------------------------------------------------------

async function hydrate(db: D1Database, row: Record<string, unknown>): Promise<Job> {
  const entryId = row.entry_id as string;
  const postingId = (row.posting_id as string | null) ?? null;
  let skills: string[] = [];
  if (postingId) {
    const { results } = await db.prepare(
      "SELECT s.name FROM posting_skills ps JOIN skills s ON s.id = ps.skill_id WHERE ps.posting_id = ?"
    ).bind(postingId).all<{ name: string }>();
    skills = results.map((r) => r.name);
  }
  const str = (v: unknown) => (v == null ? null : String(v));
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    id: entryId,
    user_id: row.user_id as string,
    company_name: (row.company_name as string) ?? "",
    is_agency: Boolean(row.is_agency),
    agency_name: str(row.agency_name),
    job_title: (row.job_title as string) ?? "",
    role: (row.role as string) ?? "",
    level: str(row.level),
    salary_min: num(row.salary_min),
    salary_max: num(row.salary_max),
    salary_currency: str(row.salary_currency),
    salary_period: str(row.salary_period),
    salary_raw_text: str(row.salary_raw_text),
    location: str(row.location),
    is_remote: Boolean(row.is_remote),
    deadline: str(row.deadline),
    url: row.submitted_url as string,
    apply_url: str(row.apply_url),
    source_site: str(row.source_site),
    snapshot: str(row.snapshot),
    description: str(row.description),
    raw_content_key: str(row.raw_content_key),
    source_method: str(row.source_method) as Job["source_method"],
    extraction_model: str(row.extraction_model),
    stage: row.stage as string,
    import_status: row.import_status as ImportStatus,
    applied_date: str(row.applied_date),
    next_action_at: str(row.next_action_at),
    notes: (row.notes as string) ?? "",
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    skills,
  };
}
```

> Note: `job_entries` and `job_postings` share column names (`id`, `created_at`). The SELECT lists `p.*` first and `e.*` last so entry values win those collisions, and stay correct when the LEFT JOIN finds no posting (importing placeholder). `e.id AS entry_id` is read explicitly by `hydrate`, which never trusts a bare `row.id`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @whats-next/api test db.test`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db.ts apps/api/test/db.test.ts
git commit -m "feat(api): split postings + entries repository"
```

## Task 8: Entry-scoped events test

**Files:**
- Modify: `apps/api/test/events.test.ts`

- [ ] **Step 1: Rewrite the events test for entries**

Replace the whole `apps/api/test/events.test.ts` with:
```ts
import { env, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { ensureUser, createImportingEntry, updateEntry, listEvents } from "../src/db";

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  for (const t of ["events", "job_entries", "job_postings", "users"]) {
    await env.DB.prepare(`DELETE FROM ${t}`).run();
  }
  await ensureUser(env.DB, "u1", "a@b.c");
});

describe("updateEntry + events", () => {
  it("changing stage records a status_change event", async () => {
    const entry = await createImportingEntry(env.DB, "u1", "https://a.com/1");
    await updateEntry(env.DB, "u1", entry.id, { stage: "Applied" });
    const events = await listEvents(env.DB, "u1", entry.id);
    const sc = events.find((e) => e.type === "status_change")!;
    expect(JSON.parse(sc.payload)).toEqual({ from: "Saved", to: "Applied" });
  });

  it("updates non-stage fields without a status event", async () => {
    const entry = await createImportingEntry(env.DB, "u1", "https://a.com/1");
    await updateEntry(env.DB, "u1", entry.id, { notes: "called recruiter" });
    const row = await env.DB.prepare("SELECT notes FROM job_entries WHERE id=?").bind(entry.id).first<{ notes: string }>();
    expect(row?.notes).toBe("called recruiter");
    expect((await listEvents(env.DB, "u1", entry.id)).filter((e) => e.type === "status_change")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm --filter @whats-next/api test events.test`
Expected: PASS (2 tests).

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/events.test.ts
git commit -m "test(api): entry-scoped events"
```

---

# Milestone 5 — Import orchestration + LLM prompt

## Task 9: LLM system prompt requests a description

**Files:**
- Modify: `apps/api/src/extract/llm.ts`

- [ ] **Step 1: Update the system prompt**

In `apps/api/src/extract/llm.ts`, replace the `SYSTEM` constant with:
```ts
const SYSTEM = "You extract structured job-posting data. Return ONLY JSON matching the schema. " +
  "Use null for unknown fields. is_agency=true only when the poster is a recruiting agency, " +
  "not the hiring company; then set agency_name. For `description`, write a concise 2-4 sentence " +
  "summary covering the role and its key responsibilities.";
```

- [ ] **Step 2: Typecheck (existing llm tests still pass — schema now includes description, mocks provide it via `valid`?)**

Run: `pnpm --filter @whats-next/api test llm`
Expected: PASS — the existing `valid` fixture lacks `description`; since the schema makes it `.nullable()` but **required**, add `description: null` to the `valid` object in `apps/api/test/llm.test.ts`.

- [ ] **Step 3: Fix the llm test fixture**

In `apps/api/test/llm.test.ts`, add `description: null,` to the `valid` object (after `apply_url: null,`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @whats-next/api test llm`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/extract/llm.ts apps/api/test/llm.test.ts
git commit -m "feat(api): LLM produces a description summary"
```

## Task 10: Rewrite the import pipeline for caching

**Files:**
- Modify: `apps/api/src/import.ts`
- Test: `apps/api/test/import.test.ts`

- [ ] **Step 1: Rewrite the import test**

Replace the whole `apps/api/test/import.test.ts` with:
```ts
import { env, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { runImport } from "../src/import";
import { ensureUser, createImportingEntry, getEntry, listEntries } from "../src/db";

const richHtml = `<html><body><article>${"Backend role at Acme. ".repeat(50)}</article></body></html>`;
const extraction = {
  company_name: "Acme", is_agency: false, agency_name: null, job_title: "Backend Eng", role: "Backend",
  level: "Senior", salary_min: null, salary_max: null, salary_currency: null, salary_period: null,
  salary_raw_text: null, location: "Remote", is_remote: true, skills: ["TypeScript"], deadline: null,
  apply_url: null, description: "Build backend things.",
};
const okFetch = () => ({ doFetch: vi.fn().mockResolvedValue(new Response(richHtml)), renderHtml: vi.fn() });
const extractOk = () => vi.fn().mockResolvedValue({ extraction, model: "test-model" });

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  for (const t of ["events", "posting_skills", "skills", "job_entries", "job_postings", "users"]) {
    await env.DB.prepare(`DELETE FROM ${t}`).run();
  }
  await ensureUser(env.DB, "u1", "a@b.c");
  await ensureUser(env.DB, "u2", "x@y.z");
});

describe("runImport caching", () => {
  it("miss: creates a posting, calls the LLM once, entry ready with data", async () => {
    const entry = await createImportingEntry(env.DB, "u1", "https://acme.com/1");
    const extract = extractOk();
    await runImport(env.DB, env.RAW_BUCKET, "u1", entry, null, { fetchDeps: okFetch(), extract });
    const updated = await getEntry(env.DB, "u1", entry.id);
    expect(updated?.import_status).toBe("ready");
    expect(updated?.company_name).toBe("Acme");
    expect(updated?.description).toBe("Build backend things.");
    expect(updated?.skills).toEqual(["TypeScript"]);
    expect(extract).toHaveBeenCalledTimes(1);
    const { results } = await env.DB.prepare("SELECT COUNT(*) n FROM job_postings").all<{ n: number }>();
    expect(results[0].n).toBe(1);
  });

  it("hit: a second user importing identical content reuses the posting, no LLM call", async () => {
    const e1 = await createImportingEntry(env.DB, "u1", "https://acme.com/1");
    await runImport(env.DB, env.RAW_BUCKET, "u1", e1, null, { fetchDeps: okFetch(), extract: extractOk() });

    const e2 = await createImportingEntry(env.DB, "u2", "https://acme.com/1");
    const extract2 = extractOk();
    await runImport(env.DB, env.RAW_BUCKET, "u2", e2, null, { fetchDeps: okFetch(), extract: extract2 });

    expect(extract2).not.toHaveBeenCalled();
    expect((await getEntry(env.DB, "u2", e2.id))?.company_name).toBe("Acme");
    const { results } = await env.DB.prepare("SELECT COUNT(*) n FROM job_postings").all<{ n: number }>();
    expect(results[0].n).toBe(1);
  });

  it("collapses one user's duplicate entries for the same content", async () => {
    const a = await createImportingEntry(env.DB, "u1", "https://acme.com/1");
    await runImport(env.DB, env.RAW_BUCKET, "u1", a, null, { fetchDeps: okFetch(), extract: extractOk() });
    const b = await createImportingEntry(env.DB, "u1", "https://acme.com/2");
    await runImport(env.DB, env.RAW_BUCKET, "u1", b, null, { fetchDeps: okFetch(), extract: extractOk() });
    expect(await listEntries(env.DB, "u1")).toHaveLength(1);
  });

  it("needs_paste when content cannot be fetched or rendered", async () => {
    const entry = await createImportingEntry(env.DB, "u1", "https://walled.com/1");
    const thin = "<html><body>Loading…</body></html>";
    await runImport(env.DB, env.RAW_BUCKET, "u1", entry, null, {
      fetchDeps: { doFetch: vi.fn().mockResolvedValue(new Response(thin)), renderHtml: vi.fn().mockResolvedValue(thin) },
      extract: vi.fn(),
    });
    expect((await getEntry(env.DB, "u1", entry.id))?.import_status).toBe("needs_paste");
  });

  it("uses pastedText directly, skipping fetch", async () => {
    const entry = await createImportingEntry(env.DB, "u1", "https://walled.com/1");
    await runImport(env.DB, env.RAW_BUCKET, "u1", entry, "Pasted job description ".repeat(40), {
      fetchDeps: { doFetch: vi.fn(), renderHtml: vi.fn() }, extract: extractOk(),
    });
    const updated = await getEntry(env.DB, "u1", entry.id);
    expect(updated?.import_status).toBe("ready");
  });

  it("marks failed when the LLM throws", async () => {
    const entry = await createImportingEntry(env.DB, "u1", "https://acme.com/1");
    await runImport(env.DB, env.RAW_BUCKET, "u1", entry, null, {
      fetchDeps: okFetch(), extract: vi.fn().mockRejectedValue(new Error("model down")),
    });
    expect((await getEntry(env.DB, "u1", entry.id))?.import_status).toBe("failed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @whats-next/api test import.test`
Expected: FAIL — `runImport` signature/behavior mismatch.

- [ ] **Step 3: Rewrite `apps/api/src/import.ts`**

Replace the entire file with:
```ts
import type { Extraction, Job, SourceMethod } from "@whats-next/shared";
import { extractReadable, isThin } from "./extract/readability";
import { fetchContent, type FetchDeps } from "./extract/fetcher";
import { contentHash } from "./extract/hash";
import { findPostingByHash, createPosting, linkEntryToPosting, markImportStatus } from "./db";

export interface ImportDeps {
  fetchDeps: FetchDeps;
  extract: (text: string) => Promise<{ extraction: Extraction; model: string }>;
}

export async function runImport(
  db: D1Database, bucket: R2Bucket, userId: string, entry: Job, pastedText: string | null, deps: ImportDeps
): Promise<void> {
  try {
    let text: string;
    let html: string | null;
    let method: SourceMethod;

    if (pastedText && !isThin(pastedText)) {
      text = extractReadable(`<body>${pastedText}</body>`, entry.url).text || pastedText;
      html = pastedText;
      method = "paste";
    } else {
      const result = await fetchContent(entry.url, deps.fetchDeps);
      if (result.method === "needs_paste" || !result.text) {
        await markImportStatus(db, entry.id, "needs_paste");
        return;
      }
      text = result.text;
      html = result.html;
      method = result.method;
    }

    const hash = await contentHash(text);
    let posting = await findPostingByHash(db, hash);
    if (!posting) {
      const { extraction, model } = await deps.extract(text);
      const rawKey = `raw/${hash}.html`;
      if (html) await bucket.put(rawKey, html);
      const postingId = await createPosting(db, {
        ...extraction, hash, snapshot: text, method, model, rawKey: html ? rawKey : null,
      });
      posting = { id: postingId };
    }
    await linkEntryToPosting(db, userId, entry.id, posting.id);
  } catch (e) {
    console.error("import failed", entry.id, e instanceof Error ? e.message : e);
    await markImportStatus(db, entry.id, "failed");
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @whats-next/api test import.test`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/import.ts apps/api/test/import.test.ts
git commit -m "feat(api): content-hash caching in the import pipeline"
```

---

# Milestone 6 — Routes

## Task 11: Wire routes to the entry/posting repository

**Files:**
- Modify: `apps/api/src/routes/jobs.ts`
- Test: `apps/api/test/routes.test.ts`, `apps/api/test/delete.test.ts`

- [ ] **Step 1: Update the route tests for entry semantics**

In `apps/api/test/routes.test.ts`, the `beforeEach` deletes old tables. Replace its loop with:
```ts
  for (const t of ["events", "posting_skills", "skills", "job_entries", "job_postings", "users"]) {
    await env.DB.prepare(`DELETE FROM ${t}`).run();
  }
```
The existing assertions (`import` returns 201 `importing`; `GET /api/jobs` lists 1; unauth 401; CORS) remain valid as-is.

In `apps/api/test/delete.test.ts`, replace its `beforeEach` table loop the same way, and add a posting-survives assertion to the delete test body (after the 204 + empty-list checks):
```ts
    const { results } = await env.DB.prepare("SELECT COUNT(*) n FROM job_postings").all<{ n: number }>();
    expect(results[0].n).toBe(1); // shared posting NOT deleted with the entry
```
(The import in delete.test creates an entry; because `runImport` is mocked to a no-op there, no posting exists — so instead assert the entry is gone and the call returned 204. Replace the added block with just keeping the existing 204 + empty-list assertions; do **not** add the posting-count check when `runImport` is mocked.)

> Net for delete.test.ts: only change the `beforeEach` table loop. Keep existing assertions.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @whats-next/api test routes delete`
Expected: FAIL — routes still call removed functions (`createImportingJob`, etc.).

- [ ] **Step 3: Rewrite `apps/api/src/routes/jobs.ts`**

Replace the entire file with:
```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @whats-next/api test routes delete`
Expected: PASS.

- [ ] **Step 5: Full API suite + typecheck**

Run: `pnpm --filter @whats-next/api test && pnpm --filter @whats-next/api typecheck`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/jobs.ts apps/api/test/routes.test.ts apps/api/test/delete.test.ts
git commit -m "feat(api): entry-scoped job routes with re-import fast path"
```

---

# Milestone 7 — Frontend description display

## Task 12: Render the description in the drawer

**Files:**
- Modify: `apps/web/src/components/JobDetailDrawer.tsx`
- Test: `apps/web/src/components/JobDetailDrawer.test.tsx`

- [ ] **Step 1: Add `description` to the test fixture and assert it renders**

In `apps/web/src/components/JobDetailDrawer.test.tsx`, add `description: "Build backend things.",` to the `baseJob` object (after `snapshot: "Job text",`). Then add this test inside the `describe`:
```ts
  it("shows the description summary", () => {
    render(<JobDetailDrawer job={baseJob} onUpdate={vi.fn()} onClose={vi.fn()} onPaste={vi.fn()} />);
    expect(screen.getByText("Build backend things.")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @whats-next/web test JobDetailDrawer`
Expected: FAIL — description not rendered.

- [ ] **Step 3: Render the description**

In `apps/web/src/components/JobDetailDrawer.tsx`, add this block immediately **before** the `{job.snapshot && (` block:
```tsx
      {job.description && (
        <p className="mt-4 text-sm text-gray-700">{job.description}</p>
      )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @whats-next/web test JobDetailDrawer`
Expected: PASS.

- [ ] **Step 5: Web suite + typecheck + build**

Run: `pnpm --filter @whats-next/web test && pnpm --filter @whats-next/web typecheck && pnpm --filter @whats-next/web build`
Expected: all green (the `App.test.tsx` mocked job lacks `description`, which is fine — it's optional in the mock object; TypeScript only checks the real `Job` type at the API boundary, not the test mock).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/JobDetailDrawer.tsx apps/web/src/components/JobDetailDrawer.test.tsx
git commit -m "feat(web): show job description summary in the drawer"
```

---

# Milestone 8 — Migrate & deploy

## Task 13: Apply the reset migration and deploy

**Files:** none (operational)

- [ ] **Step 1: Full workspace verification**

Run: `pnpm -r test && pnpm -r typecheck`
Expected: all green across shared, api, web.

- [ ] **Step 2: Apply migration locally**

Run: `pnpm --filter @whats-next/api run migrate:local`
Expected: `0002_shared_cache.sql` applied.

- [ ] **Step 3: Apply migration to remote D1 (resets prod job data)**

Run (account id exported in the shell):
```bash
cd apps/api && pnpm exec wrangler d1 migrations apply whats-next-db --remote
```
Expected: `0002_shared_cache.sql` applied remotely. (Existing tracked jobs are dropped — re-import as needed.)

- [ ] **Step 4: Deploy the API and web**

```bash
pnpm --filter @whats-next/api run deploy
pnpm --filter @whats-next/web run deploy
```

- [ ] **Step 5: Smoke test**

Import a job, confirm it populates with a description. Import the **same** job again (or from a second account) and confirm via `wrangler tail` that the second import does **not** call the LLM (cache hit) and the card still populates.

- [ ] **Step 6: Push**

```bash
git push
```

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** split model (Task 3, 7), content-hash dedup over cleaned text (Task 4, 10), hit skips LLM (Task 10), per-user collapse via UNIQUE (Task 7, 10), re-import fast path by exact URL (Task 11), refresh-on-change re-points entry (handled by `linkEntryToPosting` updating `posting_id` when an entry is reused and links to a different posting; covered implicitly — see note below), shared/private leak-safety (content-hash design, no code needed), flat `Job` DTO preserved (Task 7 `hydrate`, Task 11), description summary (Task 1, 2, 9, 12), reset migration (Task 3), delete keeps posting (Task 7 `deleteEntry`).
- **Refresh-on-change:** when an entry is reused by URL (Task 11) and the new content hashes to a *different* posting, `runImport` calls `linkEntryToPosting`, which `UPDATE`s the entry's `posting_id` to the new posting (the entry isn't a duplicate of another, so it updates rather than collapses). Tracking fields are untouched. If you want explicit coverage, add a test: import URL → change `richHtml` → re-import same URL → assert `company_name`/posting changed while `stage`/`notes` preserved.
- **`source_method` typing:** `hydrate` casts the stored string to `Job["source_method"]`; values are constrained at write time by `PostingInput.method: SourceMethod`.
- **App.test.tsx:** its mocked job object omits `description`; that's a plain object literal passed through a `vi.mock`, not type-checked against `Job`, so no change needed.
- **Pinned versions / no placeholders:** all code blocks are complete; no TODO markers.
```
