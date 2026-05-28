import { z } from "zod";

export const STAGES = [
  "Saved", "Applied", "Phone screen", "Interview", "Offer", "Rejected/Closed",
] as const;

export type Stage = (typeof STAGES)[number];
export const stageSchema = z.enum(STAGES);
export const isStage = (v: unknown): v is Stage =>
  typeof v === "string" && (STAGES as readonly string[]).includes(v);
