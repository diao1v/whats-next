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
