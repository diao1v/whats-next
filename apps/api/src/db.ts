import type { Job, JobUpdate, Extraction, ImportStatus, SourceMethod } from "@seeking/shared";
import { addEvent, type EventRow } from "./events";
import { linkSkills } from "./skills";

const newId = () => crypto.randomUUID();

const COLUMN_FOR: Record<keyof JobUpdate, string> = {
  stage: "stage", applied_date: "applied_date", next_action_at: "next_action_at", notes: "notes",
};

export async function ensureUser(db: D1Database, id: string, email: string): Promise<void> {
  await db.prepare(
    "INSERT INTO users (id, email) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email"
  ).bind(id, email).run();
}

export async function createImportingJob(db: D1Database, userId: string, url: string): Promise<Job> {
  const id = newId();
  const site = (() => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
  })();
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

export async function markImportStatus(db: D1Database, id: string, status: ImportStatus): Promise<void> {
  await db.prepare("UPDATE jobs SET import_status = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(status, id).run();
}

export async function setSnapshot(db: D1Database, id: string, text: string): Promise<void> {
  await db.prepare("UPDATE jobs SET snapshot = ? WHERE id = ?").bind(text, id).run();
}

export async function applyExtraction(
  db: D1Database, userId: string, id: string, ex: Extraction, method: SourceMethod, model: string, rawKey: string | null
): Promise<void> {
  await db.prepare(
    `UPDATE jobs SET company_name=?, is_agency=?, agency_name=?, job_title=?, role=?, level=?,
       salary_min=?, salary_max=?, salary_currency=?, salary_period=?, salary_raw_text=?,
       location=?, is_remote=?, deadline=?, apply_url=?, raw_content_key=?,
       source_method=?, extraction_model=?, stage='Saved', import_status='ready', updated_at=datetime('now')
     WHERE id=? AND user_id=?`
  ).bind(
    ex.company_name, ex.is_agency ? 1 : 0, ex.agency_name, ex.job_title, ex.role, ex.level,
    ex.salary_min, ex.salary_max, ex.salary_currency, ex.salary_period, ex.salary_raw_text,
    ex.location, ex.is_remote ? 1 : 0, ex.deadline, ex.apply_url, rawKey,
    method, model, id, userId
  ).run();
  await linkSkills(db, id, ex.skills);
}

export async function listEvents(db: D1Database, userId: string, jobId: string): Promise<EventRow[]> {
  const { results } = await db.prepare(
    "SELECT * FROM events WHERE job_id = ? AND user_id = ? ORDER BY created_at ASC"
  ).bind(jobId, userId).all<EventRow>();
  return results;
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
