import { isStage, type Stage } from "@whats-next/shared";

/** Map a drag-end (current stage, dropped-over column id) to the new stage, or null. */
export function stageFromDrop(currentStage: string, overId: string | null): Stage | null {
  if (!overId || !isStage(overId)) return null;
  if (overId === currentStage) return null;
  return overId;
}
