export interface SalaryFields {
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  salary_raw_text: string | null;
}

const PERIOD_SUFFIX: Record<string, string> = {
  year: "/yr", month: "/mo", day: "/day", hour: "/hr",
};

/**
 * Render a salary using its stored ISO currency via Intl.NumberFormat. Falls back to the
 * raw text when amounts or currency are missing, or when the currency code is invalid.
 * Returns null when there is nothing to show.
 */
export function formatSalary(s: SalaryFields): string | null {
  const { salary_min: min, salary_max: max, salary_currency: currency } = s;
  const suffix = s.salary_period ? PERIOD_SUFFIX[s.salary_period] ?? "" : "";

  if ((min != null || max != null) && currency) {
    try {
      const fmt = (n: number) =>
        new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
      let body: string;
      if (min != null && max != null) body = `${fmt(min)} – ${fmt(max)}`;
      else if (min != null) body = `From ${fmt(min)}`;
      else body = `Up to ${fmt(max as number)}`;
      return `${body}${suffix}`;
    } catch {
      // invalid currency code — fall through to raw text
    }
  }
  return s.salary_raw_text ?? null;
}
