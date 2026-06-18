import { describe, it, expect } from "vitest";
import { extractionSchema } from "./extraction";

const valid = {
  company_name: "Acme",
  is_agency: false,
  agency_name: null,
  job_title: "Senior Engineer",
  role: "Backend Engineer",
  level: "Senior",
  salary_min: 120000,
  salary_max: 150000,
  salary_currency: "USD",
  salary_period: "year",
  salary_raw_text: "$120k–150k",
  location: "Remote, US",
  is_remote: true,
  skills: ["TypeScript", "Cloudflare Workers"],
  deadline: "2026-06-30",
  apply_url: "https://acme.com/apply",
  description: "A senior backend role building developer tooling.",
};

describe("extractionSchema", () => {
  it("parses a complete valid object", () => {
    expect(extractionSchema.parse(valid)).toMatchObject({ company_name: "Acme" });
  });
  it("allows nullable optional fields", () => {
    const out = extractionSchema.parse({ ...valid, salary_min: null, deadline: null, level: null });
    expect(out.salary_min).toBeNull();
  });
  it("rejects a bad salary_period", () => {
    expect(() => extractionSchema.parse({ ...valid, salary_period: "fortnight" })).toThrow();
  });
  it("requires skills to be an array of strings", () => {
    expect(() => extractionSchema.parse({ ...valid, skills: "TypeScript" })).toThrow();
  });
  it("accepts a nullable description", () => {
    expect(extractionSchema.parse({ ...valid, description: "A backend role." }).description).toBe("A backend role.");
    expect(extractionSchema.parse({ ...valid, description: null }).description).toBeNull();
  });
});
