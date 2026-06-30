import { Skeleton } from "@/components/ui/skeleton";

// Result pages await evaluation + transcript queries; show the report skeleton
// rather than a blank screen.
export default function ResultLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b border-border px-4 sm:px-6">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-24" />
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-10 px-4 py-10 sm:px-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-8 w-64" />
        </div>

        <Skeleton className="h-20 rounded-2xl" />

        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>

        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-6 rounded-md" />
          ))}
        </div>

        <Skeleton className="h-32 rounded-2xl" />
      </main>
    </div>
  );
}
