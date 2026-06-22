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
  source_site: string | null;
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
      WHERE e.user_id = ? AND e.deleted_at IS NULL ORDER BY e.created_at DESC`
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
  // Soft delete: hidden from listEntries but restorable (preserves stage/notes/dates).
  // The shared posting and its R2 raw are left intact for other users.
  const res = await db.prepare(
    "UPDATE job_entries SET deleted_at = datetime('now') WHERE id = ? AND user_id = ? AND deleted_at IS NULL"
  ).bind(id, userId).run();
  return (res.meta.changes ?? 0) > 0;
}

export async function restoreEntry(db: D1Database, userId: string, id: string): Promise<boolean> {
  const res = await db.prepare(
    "UPDATE job_entries SET deleted_at = NULL WHERE id = ? AND user_id = ?"
  ).bind(id, userId).run();
  return (res.meta.changes ?? 0) > 0;
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
