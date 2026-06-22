import { env, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { runImport } from "../src/import";
import { ensureUser, createImportingEntry, getEntry, listEntries } from "../src/db";

const richHtml = `<html><body><article>${"Backend role at Acme. ".repeat(50)}</article></body></html>`;
const extraction = {
  company_name: "Acme", is_agency: false, agency_name: null, job_title: "Backend Eng", role: "Backend",
  level: "senior", salary_min: null, salary_max: null, salary_currency: null, salary_period: null,
  salary_raw_text: null, location: "Remote", is_remote: true, skills: ["TypeScript"], deadline: null,
  apply_url: null, description: "Build backend things.",
};
const okFetch = () => ({ doFetch: vi.fn().mockResolvedValue(new Response(richHtml)), renderHtml: vi.fn() });
const extractOk = () => vi.fn().mockResolvedValue({ extraction, model: "test-model" });

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  for (const t of ["events", "posting_skills", "skills", "job_entries", "job_postings", "users"]) {
    await env.DB.prepare(`DELETE FROM ${t}`).run();
  }
  await ensureUser(env.DB, "u1", "a@b.c");
  await ensureUser(env.DB, "u2", "x@y.z");
});

describe("runImport caching", () => {
  it("miss: creates a posting, calls the LLM once, entry ready with data", async () => {
    const entry = await createImportingEntry(env.DB, "u1", "https://acme.com/1");
    const extract = extractOk();
    await runImport(env.DB, env.RAW_BUCKET, "u1", entry, null, { fetchDeps: okFetch(), extract });
    const updated = await getEntry(env.DB, "u1", entry.id);
    expect(updated?.import_status).toBe("ready");
    expect(updated?.company_name).toBe("Acme");
    expect(updated?.description).toBe("Build backend things.");
    expect(updated?.skills).toEqual(["TypeScript"]);
    expect(extract).toHaveBeenCalledTimes(1);
    const { results } = await env.DB.prepare("SELECT COUNT(*) n FROM job_postings").all<{ n: number }>();
    expect(results[0].n).toBe(1);
  });

  it("hit: a second user importing identical content reuses the posting, no LLM call", async () => {
    const e1 = await createImportingEntry(env.DB, "u1", "https://acme.com/1");
    await runImport(env.DB, env.RAW_BUCKET, "u1", e1, null, { fetchDeps: okFetch(), extract: extractOk() });

    const e2 = await createImportingEntry(env.DB, "u2", "https://acme.com/1");
    const extract2 = extractOk();
    await runImport(env.DB, env.RAW_BUCKET, "u2", e2, null, { fetchDeps: okFetch(), extract: extract2 });

    expect(extract2).not.toHaveBeenCalled();
    expect((await getEntry(env.DB, "u2", e2.id))?.company_name).toBe("Acme");
    const { results } = await env.DB.prepare("SELECT COUNT(*) n FROM job_postings").all<{ n: number }>();
    expect(results[0].n).toBe(1);
  });

  it("collapses one user's duplicate entries for the same content", async () => {
    const a = await createImportingEntry(env.DB, "u1", "https://acme.com/1");
    await runImport(env.DB, env.RAW_BUCKET, "u1", a, null, { fetchDeps: okFetch(), extract: extractOk() });
    const b = await createImportingEntry(env.DB, "u1", "https://acme.com/2");
    await runImport(env.DB, env.RAW_BUCKET, "u1", b, null, { fetchDeps: okFetch(), extract: extractOk() });
    expect(await listEntries(env.DB, "u1")).toHaveLength(1);
  });

  it("needs_paste when content cannot be fetched or rendered", async () => {
    const entry = await createImportingEntry(env.DB, "u1", "https://walled.com/1");
    const thin = "<html><body>Loading…</body></html>";
    await runImport(env.DB, env.RAW_BUCKET, "u1", entry, null, {
      fetchDeps: { doFetch: vi.fn().mockResolvedValue(new Response(thin)), renderHtml: vi.fn().mockResolvedValue(thin) },
      extract: vi.fn(),
    });
    expect((await getEntry(env.DB, "u1", entry.id))?.import_status).toBe("needs_paste");
  });

  it("uses pastedText directly, skipping fetch", async () => {
    const entry = await createImportingEntry(env.DB, "u1", "https://walled.com/1");
    await runImport(env.DB, env.RAW_BUCKET, "u1", entry, "Pasted job description ".repeat(40), {
      fetchDeps: { doFetch: vi.fn(), renderHtml: vi.fn() }, extract: extractOk(),
    });
    const updated = await getEntry(env.DB, "u1", entry.id);
    expect(updated?.import_status).toBe("ready");
  });

  it("marks failed when the LLM throws", async () => {
    const entry = await createImportingEntry(env.DB, "u1", "https://acme.com/1");
    await runImport(env.DB, env.RAW_BUCKET, "u1", entry, null, {
      fetchDeps: okFetch(), extract: vi.fn().mockRejectedValue(new Error("model down")),
    });
    expect((await getEntry(env.DB, "u1", entry.id))?.import_status).toBe("failed");
  });
});
