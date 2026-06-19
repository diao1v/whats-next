import type { ReactNode } from "react";

export function EmptyState({ title, message, icon }: { title: string; message?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-paper/60 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-primary">{icon}</div>}
      <p className="font-semibold text-ink">{title}</p>
      {message && <p className="mt-1 text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
