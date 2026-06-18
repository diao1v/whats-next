import type { Stage } from "@whats-next/shared";

/** Tailwind classes per pipeline stage (single source of truth for stage color). */
export const STAGE_STYLES: Record<Stage, string> = {
  "Saved": "bg-[#f6ead9] text-[#7c5e3b]",
  "Applied": "bg-[#fef3c7] text-[#b45309]",
  "Phone screen": "bg-blue-100 text-blue-700",
  "Interview": "bg-lime-100 text-lime-800",
  "Offer": "bg-green-100 text-green-700",
  "Rejected/Closed": "bg-slate-100 text-slate-500",
};
