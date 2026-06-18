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
