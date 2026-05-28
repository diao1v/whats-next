import { env, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("schema", () => {
  it("creates the expected tables", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all<{ name: string }>();
    const names = results.map((r) => r.name);
    for (const t of ["users", "jobs", "skills", "job_skills", "events"]) {
      expect(names).toContain(t);
    }
  });

  it("enforces job_skills composite PK", async () => {
    await env.DB.prepare("INSERT INTO users (id, email) VALUES ('u1','a@b.c')").run();
    await env.DB.prepare(
      "INSERT INTO jobs (id, user_id, url, company_name, job_title, role, is_agency, is_remote, stage, import_status, notes) VALUES ('j1','u1','http://x','Acme','Eng','Eng',0,0,'Saved','ready','')"
    ).run();
    await env.DB.prepare("INSERT INTO skills (id, slug, name) VALUES ('s1','react','React')").run();
    await env.DB.prepare("INSERT INTO job_skills (job_id, skill_id, raw_label) VALUES ('j1','s1','ReactJS')").run();
    await expect(
      env.DB.prepare("INSERT INTO job_skills (job_id, skill_id, raw_label) VALUES ('j1','s1','React')").run()
    ).rejects.toThrow();
  });
});
