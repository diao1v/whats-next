export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-line/70 ${className ?? ""}`} />;
}

export function SkeletonCard() {
  return (
    <div className="space-y-2 rounded-xl border border-line bg-paper p-3 shadow-card">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}
