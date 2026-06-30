import { cn } from "@/lib/utils";

// ── Calibrated design-system primitives ──
// Built on semantic tokens (bg-card / border-border / text-foreground) so both
// themes keep working. The "elevated" treatment is a hairline border plus a faint
// inset top-highlight — depth without heavy shadows.

const ELEVATED =
  "rounded-2xl border border-border bg-card [box-shadow:inset_0_1px_0_0_oklch(1_0_0/0.05)]";

export function Surface({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(ELEVATED, className)} {...props}>
      {children}
    </div>
  );
}

// Small uppercase mono label — the "instrument readout" kicker used above sections.
export function Kicker({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}

// Titled surface card with an icon header — the workhorse panel for analytics.
export function Panel({
  title,
  icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Surface className={cn("flex h-full flex-col p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <Kicker>{title}</Kicker>
        </div>
        {action}
      </div>
      <div className={cn("flex-1", bodyClassName)}>{children}</div>
    </Surface>
  );
}
