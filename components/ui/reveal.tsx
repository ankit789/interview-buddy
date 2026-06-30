import { cn } from "@/lib/utils";

// Staggered entrance wrapper. Pure CSS (.ib-reveal runs on mount), so it stays
// server-renderable — pass `index` to offset each sibling by `step` ms.
export function Reveal({
  index = 0,
  step = 60,
  className,
  children,
  ...props
}: {
  index?: number;
  step?: number;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("ib-reveal", className)}
      style={{ ["--ib-delay" as string]: `${index * step}ms` }}
      {...props}
    >
      {children}
    </div>
  );
}
