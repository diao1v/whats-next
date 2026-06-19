import { toast } from "sonner";

export const notify = {
  added: (title: string, company: string) =>
    toast.success(`Added — ${title || "Untitled"}${company ? ` at ${company}` : ""}`),
  importing: () => toast.loading("Extracting job details…", { id: "import" }),
  importFailed: () => toast.error("Couldn't import that job"),
  moved: (stage: string) => toast.success(`Moved to ${stage}`),
  saved: () => toast.success("Saved", { duration: 1200 }),
  error: (message: string) => toast.error(message),
  deletedWithUndo: (onUndo: () => void) =>
    toast("Job deleted", { action: { label: "Undo", onClick: onUndo } }),
  dismiss: (id?: string | number) => toast.dismiss(id),
};
