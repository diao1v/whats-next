import { env, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { runImport } from "../src/import";
import { ensureUser, createImportingJob, getJob } from "../src/db";

const richHtml = `<html><body><article>${"Backend role at Acme. ".repeat(50)}</article></body></html>`;
const extraction = {
  company_name: "Acme", is_agency: false, agency_name: null, job_title: "Backend Eng", role: "Backend",
  level: "Senior", salary_min: null, salary_max: null, salary_currency: null, salary_period: null,
  salary_raw_text: null, location: "Remote", is_remote: true, skills: ["TypeScript"], deadline: null, apply_url: null,
};

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  for (const t of ["job_skills", "skills", "events", "jobs", "users"]) {
    await env.DB.prepare(`DELETE FROM ${t}`).run();
  }
  await ensureUser(env.DB, "u1", "a@b.c");
});

describe("runImport", () => {
  it("populates the job and marks it ready on success", async () => {
    const job = await createImportingJob(env.DB, "u1", "https://acme.com/1");
    await runImport(env.DB, env.RAW_BUCKET, "u1", job, null, {
      fetchDeps: { doFetch: vi.fn().mockResolvedValue(new Response(richHtml)), renderHtml: vi.fn() },
      extract: vi.fn().mockResolvedValue({ extraction, model: "test-model" }),
    });
    const updated = await getJob(env.DB, "u1", job.id);
    expect(updated?.import_status).toBe("ready");
    expect(updated?.company_name).toBe("Acme");
    expect(updated?.extraction_model).toBe("test-model");
    expect(updated?.skills).toEqual(["TypeScript"]);
    expect(updated?.source_method).toBe("fetch");
    expect(updated?.raw_content_key).toBeTruthy();
  });

  it("marks needs_paste when content cannot be fetched or rendered", async () => {
    const job = await createImportingJob(env.DB, "u1", "https://walled.com/1");
    const thin = "<html><body>Loading…</body></html>";
    await runImport(env.DB, env.RAW_BUCKET, "u1", job, null, {
      fetchDeps: { doFetch: vi.fn().mockResolvedValue(new Response(thin)), renderHtml: vi.fn().mockResolvedValue(thin) },
      extract: vi.fn(),
    });
    const updated = await getJob(env.DB, "u1", job.id);
    expect(updated?.import_status).toBe("needs_paste");
  });

  it("uses pastedText directly, skipping fetch", async () => {
    const job = await createImportingJob(env.DB, "u1", "https://walled.com/1");
    const extract = vi.fn().mockResolvedValue({ extraction, model: "test-model" });
    await runImport(env.DB, env.RAW_BUCKET, "u1", job, "Pasted job description ".repeat(40), {
      fetchDeps: { doFetch: vi.fn(), renderHtml: vi.fn() },
      extract,
    });
    const updated = await getJob(env.DB, "u1", job.id);
    expect(updated?.import_status).toBe("ready");
    expect(updated?.source_method).toBe("paste");
  });

  it("marks failed when the LLM throws", async () => {
    const job = await createImportingJob(env.DB, "u1", "https://acme.com/1");
    await runImport(env.DB, env.RAW_BUCKET, "u1", job, null, {
      fetchDeps: { doFetch: vi.fn().mockResolvedValue(new Response(richHtml)), renderHtml: vi.fn() },
      extract: vi.fn().mockRejectedValue(new Error("model down")),
    });
    const updated = await getJob(env.DB, "u1", job.id);
    expect(updated?.import_status).toBe("failed");
  });
});
