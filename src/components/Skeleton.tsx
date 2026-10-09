export function Skeleton({ className = "", style = {} }: { className?: string, style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-md ${className}`}
      style={{ background: "var(--bg-subtle)", ...style }}
    />
  );
}

export function SkeletonCourt() {
  return (
    <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl" style={{ background: "var(--bg-subtle)" }} />
      <div className="pl-2 flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-20 rounded-full" />
        <div className="space-y-2 mt-2">
          <div>
            <Skeleton className="h-3 w-12 mb-1" />
            <div className="flex gap-1">
              <Skeleton className="h-6 w-16 rounded-lg" />
              <Skeleton className="h-6 w-16 rounded-lg" />
            </div>
          </div>
          <div>
            <Skeleton className="h-3 w-12 mb-1" />
            <div className="flex gap-1">
              <Skeleton className="h-6 w-16 rounded-lg" />
              <Skeleton className="h-6 w-16 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SkeletonLeaderboardRow() {
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: "var(--separator)" }}>
      <Skeleton className="w-6 h-6 rounded-full flex-shrink-0" />
      <Skeleton className="flex-1 h-4" />
      <Skeleton className="w-6 h-4 mr-3" />
      <Skeleton className="w-8 h-5" />
    </div>
  );
}
