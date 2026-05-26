import { env, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { ensureUser, createImportingJob, getJob, listJobs } from "../src/db";

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM job_skills").run();
  await env.DB.prepare("DELETE FROM jobs").run();
  await env.DB.prepare("DELETE FROM users").run();
});

describe("db repository", () => {
  it("ensureUser is idempotent", async () => {
    await ensureUser(env.DB, "u1", "a@b.c");
    await ensureUser(env.DB, "u1", "a@b.c");
    const { results } = await env.DB.prepare("SELECT COUNT(*) n FROM users").all<{ n: number }>();
    expect(results[0].n).toBe(1);
  });

  it("createImportingJob inserts an importing row scoped to the user", async () => {
    await ensureUser(env.DB, "u1", "a@b.c");
    const job = await createImportingJob(env.DB, "u1", "https://acme.com/jobs/1");
    expect(job.import_status).toBe("importing");
    expect(job.url).toBe("https://acme.com/jobs/1");
    expect(job.source_site).toBe("acme.com");
    const fetched = await getJob(env.DB, "u1", job.id);
    expect(fetched?.id).toBe(job.id);
  });

  it("listJobs only returns the user's own jobs", async () => {
    await ensureUser(env.DB, "u1", "a@b.c");
    await ensureUser(env.DB, "u2", "x@y.z");
    await createImportingJob(env.DB, "u1", "https://a.com/1");
    await createImportingJob(env.DB, "u2", "https://b.com/2");
    const jobs = await listJobs(env.DB, "u1");
    expect(jobs).toHaveLength(1);
    expect(jobs[0].user_id).toBe("u1");
  });
});
