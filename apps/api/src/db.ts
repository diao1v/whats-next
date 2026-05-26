import type { Job } from "@seeking/shared";

const newId = () => crypto.randomUUID();

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
