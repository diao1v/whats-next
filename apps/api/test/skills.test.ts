import { env, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { slugifySkill, linkPostingSkills } from "../src/skills";

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM posting_skills").run();
  await env.DB.prepare("DELETE FROM skills").run();
  await env.DB.prepare("DELETE FROM job_postings").run();
  await env.DB.prepare(
    "INSERT INTO job_postings (id, content_hash) VALUES ('p1','h1')"
  ).run();
});

describe("skills", () => {
  it("slugify converges variants", () => {
    expect(slugifySkill("React JS")).toBe(slugifySkill("react js"));
    expect(slugifySkill("  React  ")).toBe("react");
  });

  it("links skills to a posting, reusing rows by slug and keeping raw labels", async () => {
    await linkPostingSkills(env.DB, "p1", ["React", "TypeScript"]);
    await linkPostingSkills(env.DB, "p1", ["  react  "]);
    const { results: skills } = await env.DB.prepare("SELECT slug FROM skills ORDER BY slug").all<{ slug: string }>();
    expect(skills.map((s) => s.slug)).toEqual(["react", "typescript"]);
    const { results: links } = await env.DB.prepare(
      "SELECT raw_label FROM posting_skills WHERE posting_id = ? ORDER BY raw_label"
    ).bind("p1").all<{ raw_label: string }>();
    expect(links.map((l) => l.raw_label)).toContain("React");
  });
});
