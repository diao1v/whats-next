import type { Stage } from "@whats-next/shared";
import { Badge } from "@/components/ui/badge";
import { STAGE_STYLES } from "../lib/stages";

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <Badge data-stage={stage} variant="secondary" className={`border-transparent ${STAGE_STYLES[stage]}`}>
      {stage}
    </Badge>
  );
}
