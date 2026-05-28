import { env, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { ensureUser, createImportingJob, updateJob, listEvents } from "../src/db";

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM events").run();
  await env.DB.prepare("DELETE FROM jobs").run();
  await env.DB.prepare("DELETE FROM users").run();
  await ensureUser(env.DB, "u1", "a@b.c");
});

describe("updateJob + events", () => {
  it("changing stage records a status_change event", async () => {
    const job = await createImportingJob(env.DB, "u1", "https://a.com/1");
    await updateJob(env.DB, "u1", job.id, { stage: "Applied" });
    const events = await listEvents(env.DB, "u1", job.id);
    expect(events.some((e) => e.type === "status_change")).toBe(true);
    const sc = events.find((e) => e.type === "status_change")!;
    expect(JSON.parse(sc.payload)).toEqual({ from: "Saved", to: "Applied" });
  });

  it("updates non-stage fields without a status event", async () => {
    const job = await createImportingJob(env.DB, "u1", "https://a.com/1");
    await updateJob(env.DB, "u1", job.id, { notes: "called recruiter" });
    const updated = await env.DB.prepare("SELECT notes FROM jobs WHERE id=?").bind(job.id).first<{ notes: string }>();
    expect(updated?.notes).toBe("called recruiter");
    const events = await listEvents(env.DB, "u1", job.id);
    expect(events.filter((e) => e.type === "status_change")).toHaveLength(0);
  });
});
