import { useDraggable } from "@dnd-kit/core";
import type { Job, Stage } from "@whats-next/shared";
import { JobCardBody } from "./JobCardBody";

/** Draggable board card: wraps JobCardBody with dnd-kit draggable state. */
export function JobCard(props: {
  job: Job;
  onSelect: (id: string) => void;
  onStageChange: (id: string, stage: Stage) => void;
  onRetry: (id: string) => void;
}) {
  const drag = useDraggable({ id: props.job.id });
  return <JobCardBody {...props} drag={drag} />;
}
