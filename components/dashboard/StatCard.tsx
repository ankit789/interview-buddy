"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";

export type StatTone = "accent" | "emerald" | "amber" | "rose";

// Verdict color language, shared across the dashboard. `accent` is the neutral
// hero tone (electric blue from --primary); the rest map to the verdict scale.
const TONE: Record<
  StatTone,
  { text: string; bar: string; ring: string; glow: string }
> = {
  accent: {
    text: "text-primary",
    bar: "bg-primary",
    ring: "border-primary/30",
    glow: "shadow-[0_0_28px_-10px_oklch(0.68_0.18_250/0.55)]",
  },
  emerald: {
    text: "text-emerald-400",
    bar: "bg-emerald-400",
    ring: "border-emerald-400/25",
    glow: "",
  },
  amber: {
    text: "text-amber-400",
    bar: "bg-amber-400",
    ring: "border-amber-400/25",
    glow: "",
  },
  rose: {
    text: "text-rose-400",
    bar: "bg-rose-400",
    ring: "border-rose-400/25",
    glow: "",
  },
};

export function StatCard({
  label,
  value,
  total,
  tone,
  hint,
}: {
  label: string;
  value: number;
  total?: number; // for the proportion bar (e.g. share of completed)
  tone: StatTone;
  hint?: string;
}) {
  const n = useCountUp(value);
  const pct = total && total > 0 ? Math.round((value / total) * 100) : 0;
  const t = TONE[tone];

  // Grow the proportion bar from 0 on mount.
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card p-4 transition-transform duration-200 hover:-translate-y-0.5",
        "[box-shadow:inset_0_1px_0_0_oklch(1_0_0/0.05)]",
        tone === "accent" ? t.ring : "border-border",
        tone === "accent" && t.glow
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <span className={cn("h-1.5 w-1.5 rounded-full", t.bar)} />
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-mono text-3xl font-semibold tabular-nums leading-none",
            tone === "accent" ? t.text : "text-foreground"
          )}
        >
          {n}
        </span>
        {hint && (
          <span className="font-mono text-[10px] text-muted-foreground">{hint}</span>
        )}
      </div>

      {total != null && (
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-[width] duration-700 ease-out", t.bar)}
            style={{ width: `${w}%` }}
          />
        </div>
      )}
    </div>
  );
}
