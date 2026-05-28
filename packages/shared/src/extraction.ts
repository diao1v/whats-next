import { z } from "zod";

export const salaryPeriodSchema = z.enum(["year", "month", "day", "hour"]);

export const extractionSchema = z.object({
  company_name: z.string(),
  is_agency: z.boolean(),
  agency_name: z.string().nullable(),
  job_title: z.string(),
  role: z.string(),
  level: z.string().nullable(),
  salary_min: z.number().nullable(),
  salary_max: z.number().nullable(),
  salary_currency: z.string().nullable(),
  salary_period: salaryPeriodSchema.nullable(),
  salary_raw_text: z.string().nullable(),
  location: z.string().nullable(),
  is_remote: z.boolean(),
  skills: z.array(z.string()),
  deadline: z.string().nullable(), // ISO-8601 date
  apply_url: z.string().nullable(),
});

export type Extraction = z.infer<typeof extractionSchema>;
