import { Navbar } from "@/components/layout/Navbar";
import { Skeleton } from "@/components/ui/skeleton";

// Shown while the dashboard queries resolve — mirrors the real layout so the
// page doesn't reflow when data lands.
export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 lg:py-14">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Skeleton className="h-64 rounded-2xl lg:col-span-3" />
          <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
        </div>

        <Skeleton className="mt-4 h-56 rounded-2xl" />

        <div className="mt-10 space-y-2">
          <Skeleton className="h-3 w-24" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </main>
    </div>
  );
}
