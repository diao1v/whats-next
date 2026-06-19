import type { Stage } from "@whats-next/shared";
import { STAGE_STYLES } from "../lib/stages";

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span
      data-stage={stage}
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${STAGE_STYLES[stage]}`}
    >
      {stage}
    </span>
  );
}
