import { env, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  ensureUser, createImportingEntry, findEntryByUrl, getEntry, listEntries,
  findPostingByHash, createPosting, linkEntryToPosting, deleteEntry, restoreEntry, type PostingInput,
} from "../src/db";

const ex: PostingInput = {
  hash: "h1", company_name: "Acme", is_agency: false, agency_name: null, job_title: "Backend Eng",
  role: "Backend", level: "Senior", salary_min: null, salary_max: null, salary_currency: null,
  salary_period: null, salary_raw_text: null, location: "Remote", is_remote: true, deadline: null,
  apply_url: null, source_site: "acme.com", description: "Build things.", snapshot: "full text",
  skills: ["TypeScript"], method: "fetch", model: "m", rawKey: "raw/h1.html",
};

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  for (const t of ["events", "posting_skills", "skills", "job_entries", "job_postings", "users"]) {
    await env.DB.prepare(`DELETE FROM ${t}`).run();
  }
  await ensureUser(env.DB, "u1", "a@b.c");
});

describe("entries", () => {
  it("createImportingEntry inserts an importing entry and getEntry returns flat Job", async () => {
    const entry = await createImportingEntry(env.DB, "u1", "https://acme.com/1");
    expect(entry.import_status).toBe("importing");
    expect(entry.url).toBe("https://acme.com/1");
    expect(entry.company_name).toBe("");
    expect((await getEntry(env.DB, "u1", entry.id))?.id).toBe(entry.id);
  });

  it("listEntries returns only the caller's entries", async () => {
    await ensureUser(env.DB, "u2", "x@y.z");
    await createImportingEntry(env.DB, "u1", "https://a.com/1");
    await createImportingEntry(env.DB, "u2", "https://b.com/2");
    const list = await listEntries(env.DB, "u1");
    expect(list).toHaveLength(1);
    expect(list[0].user_id).toBe("u1");
  });

  it("findEntryByUrl finds the caller's entry by exact url", async () => {
    const e = await createImportingEntry(env.DB, "u1", "https://a.com/1");
    expect((await findEntryByUrl(env.DB, "u1", "https://a.com/1"))?.id).toBe(e.id);
    expect(await findEntryByUrl(env.DB, "u1", "https://other.com")).toBeNull();
  });
});

describe("postings", () => {
  it("createPosting then findPostingByHash returns the posting; getEntry joins its fields", async () => {
    const entry = await createImportingEntry(env.DB, "u1", "https://acme.com/1");
    const postingId = await createPosting(env.DB, ex);
    expect((await findPostingByHash(env.DB, "h1"))?.id).toBe(postingId);

    await linkEntryToPosting(env.DB, "u1", entry.id, postingId);
    const joined = await getEntry(env.DB, "u1", entry.id);
    expect(joined?.import_status).toBe("ready");
    expect(joined?.company_name).toBe("Acme");
    expect(joined?.description).toBe("Build things.");
    expect(joined?.skills).toEqual(["TypeScript"]);
  });

  it("createPosting is idempotent on content_hash (concurrent race)", async () => {
    const id1 = await createPosting(env.DB, ex);
    const id2 = await createPosting(env.DB, ex);
    expect(id2).toBe(id1);
    const { results } = await env.DB.prepare("SELECT COUNT(*) n FROM job_postings").all<{ n: number }>();
    expect(results[0].n).toBe(1);
  });

  it("linkEntryToPosting collapses a duplicate to a single entry per user+posting", async () => {
    const a = await createImportingEntry(env.DB, "u1", "https://acme.com/1");
    const b = await createImportingEntry(env.DB, "u1", "https://acme.com/2"); // same job, different url
    const postingId = await createPosting(env.DB, ex);
    const survivorA = await linkEntryToPosting(env.DB, "u1", a.id, postingId);
    const survivorB = await linkEntryToPosting(env.DB, "u1", b.id, postingId);
    expect(survivorA).toBe(a.id);
    expect(survivorB).toBe(a.id); // collapsed onto the first
    expect(await getEntry(env.DB, "u1", b.id)).toBeNull();
    expect(await listEntries(env.DB, "u1")).toHaveLength(1);
  });
});

describe("soft delete", () => {
  it("deleteEntry hides from listEntries; restoreEntry brings it back", async () => {
    const e = await createImportingEntry(env.DB, "u1", "https://acme.com/1");
    expect(await listEntries(env.DB, "u1")).toHaveLength(1);
    expect(await deleteEntry(env.DB, "u1", e.id)).toBe(true);
    expect(await listEntries(env.DB, "u1")).toHaveLength(0);
    expect(await restoreEntry(env.DB, "u1", e.id)).toBe(true);
    expect(await listEntries(env.DB, "u1")).toHaveLength(1);
  });

  it("findEntryByUrl ignores soft-deleted entries (re-import makes a fresh one)", async () => {
    const e = await createImportingEntry(env.DB, "u1", "https://acme.com/1");
    await deleteEntry(env.DB, "u1", e.id);
    expect(await findEntryByUrl(env.DB, "u1", "https://acme.com/1")).toBeNull();
  });

  it("re-capturing a deleted job's content resurrects the original entry (no duplicate, no unique conflict)", async () => {
    const old = await createImportingEntry(env.DB, "u1", "https://acme.com/1");
    const postingId = await createPosting(env.DB, ex);
    await linkEntryToPosting(env.DB, "u1", old.id, postingId);
    await deleteEntry(env.DB, "u1", old.id);              // user deletes it
    expect(await listEntries(env.DB, "u1")).toHaveLength(0);
    const fresh = await createImportingEntry(env.DB, "u1", "https://acme.com/2"); // re-capture, same content
    const survivor = await linkEntryToPosting(env.DB, "u1", fresh.id, postingId);
    expect(survivor).toBe(old.id);                        // resurrected the original, dropped the placeholder
    const list = await listEntries(env.DB, "u1");
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(old.id);
  });
});
