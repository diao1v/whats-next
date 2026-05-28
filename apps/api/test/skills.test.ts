import { env, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { slugifySkill, linkSkills } from "../src/skills";
import { ensureUser, createImportingJob } from "../src/db";

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM job_skills").run();
  await env.DB.prepare("DELETE FROM skills").run();
  await env.DB.prepare("DELETE FROM jobs").run();
  await env.DB.prepare("DELETE FROM users").run();
  await ensureUser(env.DB, "u1", "a@b.c");
});

describe("skills", () => {
  it("slugify converges variants", () => {
    expect(slugifySkill("ReactJS")).toBe(slugifySkill("React JS"));
    expect(slugifySkill("  React  ")).toBe("react");
  });

  it("links skills, reusing existing rows by slug and keeping raw labels", async () => {
    const job = await createImportingJob(env.DB, "u1", "https://a.com/1");
    await linkSkills(env.DB, job.id, ["React", "TypeScript"]);
    await linkSkills(env.DB, job.id, ["  react  "]); // same slug as React
    const { results: skills } = await env.DB.prepare("SELECT slug FROM skills ORDER BY slug").all<{ slug: string }>();
    expect(skills.map((s) => s.slug)).toEqual(["react", "typescript"]);
    const { results: links } = await env.DB.prepare(
      "SELECT raw_label FROM job_skills WHERE job_id = ? ORDER BY raw_label"
    ).bind(job.id).all<{ raw_label: string }>();
    expect(links.map((l) => l.raw_label)).toContain("React");
  });
});
