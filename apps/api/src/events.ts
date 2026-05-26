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
