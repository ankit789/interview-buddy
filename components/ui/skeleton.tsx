import { cn } from "@/lib/utils";

// Pulsing placeholder block. Used to build per-route loading skeletons so
// data-backed pages show structure instead of a blank screen while fetching.
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/60", className)}
      {...props}
    />
  );
}
