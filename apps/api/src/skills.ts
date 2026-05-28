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
