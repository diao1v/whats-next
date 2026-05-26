import { z } from "zod";
import { stageSchema } from "./stages";

export const importStatusSchema = z.enum(["importing", "needs_paste", "ready", "failed"]);
export type ImportStatus = z.infer<typeof importStatusSchema>;

export const sourceMethodSchema = z.enum(["fetch", "render", "paste"]);
export type SourceMethod = z.infer<typeof sourceMethodSchema>;

/** Fields the user may edit on a job. */
export const jobUpdateSchema = z.object({
  stage: stageSchema.optional(),
  applied_date: z.string().nullable().optional(),
  next_action_at: z.string().nullable().optional(),
  notes: z.string().optional(),
}).strict();
export type JobUpdate = z.infer<typeof jobUpdateSchema>;

export interface Job {
  id: string;
  user_id: string;
  company_name: string;
  is_agency: boolean;
  agency_name: string | null;
  job_title: string;
  role: string;
  level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  salary_raw_text: string | null;
  location: string | null;
  is_remote: boolean;
  deadline: string | null;
  url: string;
  apply_url: string | null;
  source_site: string | null;
  snapshot: string | null;
  raw_content_key: string | null;
  source_method: SourceMethod | null;
  extraction_model: string | null;
  stage: string;
  import_status: ImportStatus;
  applied_date: string | null;
  next_action_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
  skills: string[];
}

export const importRequestSchema = z.object({
  url: z.string().url(),
  pastedText: z.string().optional(),
}).strict();
export type ImportRequest = z.infer<typeof importRequestSchema>;
