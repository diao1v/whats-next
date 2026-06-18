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
