import { describe, it, expect } from "vitest";
import { formatSalary } from "./salary";

const base = {
  salary_min: null as number | null, salary_max: null as number | null,
  salary_currency: null as string | null, salary_period: null as string | null,
  salary_raw_text: null as string | null,
};

describe("formatSalary", () => {
  it("formats a min–max range with currency and period", () => {
    const out = formatSalary({ ...base, salary_min: 120000, salary_max: 150000, salary_currency: "NZD", salary_period: "year" })!;
    expect(out).toContain("120,000");
    expect(out).toContain("150,000");
    expect(out).toContain("–");
    expect(out).toMatch(/\/yr$/);
    // NZD renders with a dollar-style symbol via Intl
    expect(out).toMatch(/\$/);
  });

  it("uses the stored currency, not USD", () => {
    const gbp = formatSalary({ ...base, salary_min: 50000, salary_max: 50000, salary_currency: "GBP", salary_period: "year" })!;
    expect(gbp).toContain("£");
  });

  it("handles min-only and max-only", () => {
    expect(formatSalary({ ...base, salary_min: 90000, salary_currency: "USD", salary_period: "year" })).toMatch(/^From /);
    expect(formatSalary({ ...base, salary_max: 90000, salary_currency: "USD", salary_period: "year" })).toMatch(/^Up to /);
  });

  it("appends the right period suffix", () => {
    expect(formatSalary({ ...base, salary_min: 50, salary_max: 60, salary_currency: "USD", salary_period: "hour" })).toMatch(/\/hr$/);
    expect(formatSalary({ ...base, salary_min: 5000, salary_max: 6000, salary_currency: "USD", salary_period: "month" })).toMatch(/\/mo$/);
  });

  it("falls back to raw text when amounts or currency are missing", () => {
    expect(formatSalary({ ...base, salary_raw_text: "$120k–150k DOE" })).toBe("$120k–150k DOE");
    expect(formatSalary({ ...base, salary_min: 100000, salary_raw_text: "100k" })).toBe("100k"); // no currency -> raw
  });

  it("returns null when there is nothing to show", () => {
    expect(formatSalary(base)).toBeNull();
  });

  it("degrades gracefully on an invalid currency code", () => {
    expect(formatSalary({ ...base, salary_min: 100, salary_max: 200, salary_currency: "NOTACUR", salary_raw_text: "100-200" })).toBe("100-200");
  });
});
