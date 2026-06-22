import { contentHash } from "./extract/hash";

export interface TokenSummary { id: string; name: string; created_at: string; last_used_at: string | null; }

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `wn_${b64}`;
}

export function tokenHash(plaintext: string): Promise<string> {
  return contentHash(plaintext);
}

export async function createToken(
  db: D1Database, userId: string, name: string | undefined
): Promise<{ id: string; name: string; token: string; created_at: string }> {
  const token = generateToken();
  const id = crypto.randomUUID();
  const hash = await tokenHash(token);
  await db.prepare("INSERT INTO api_tokens (id, user_id, name, token_hash) VALUES (?, ?, ?, ?)")
    .bind(id, userId, name ?? "", hash).run();
  const row = await db.prepare("SELECT created_at FROM api_tokens WHERE id=?").bind(id).first<{ created_at: string }>();
  return { id, name: name ?? "", token, created_at: row!.created_at };
}

export async function listTokens(db: D1Database, userId: string): Promise<TokenSummary[]> {
  const { results } = await db.prepare(
    "SELECT id, name, created_at, last_used_at FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC"
  ).bind(userId).all<TokenSummary>();
  return results;
}

export async function revokeToken(db: D1Database, userId: string, id: string): Promise<boolean> {
  const res = await db.prepare("DELETE FROM api_tokens WHERE id = ? AND user_id = ?").bind(id, userId).run();
  return (res.meta.changes ?? 0) > 0;
}

export async function findUserByToken(db: D1Database, hash: string): Promise<string | null> {
  const row = await db.prepare("SELECT id, user_id FROM api_tokens WHERE token_hash = ?").bind(hash)
    .first<{ id: string; user_id: string }>();
  if (!row) return null;
  await db.prepare("UPDATE api_tokens SET last_used_at = datetime('now') WHERE id = ?").bind(row.id).run();
  return row.user_id;
}
