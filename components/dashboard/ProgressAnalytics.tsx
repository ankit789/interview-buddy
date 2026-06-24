"use client";

import { useState } from "react";
import { TrendingUp, Target, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrendPoint, DimensionStat, GapStat } from "@/lib/analytics";

const TYPE_LABEL: Record<string, string> = {
  system_design: "System Design",
  lld: "Low-Level Design",
  behavioral: "Behavioral",
  sdet_test_design: "SDET — Test Design",
};

const VERDICT_DOT: Record<string, string> = {
  "Strong Hire": "var(--color-green-400, #4ade80)",
  Borderline: "var(--color-yellow-400, #facc15)",
  "Not Ready": "var(--color-red-400, #f87171)",
};

interface ProgressAnalyticsProps {
  trend: TrendPoint[];
  dimensionStats: Record<string, DimensionStat[]>;
  gaps: GapStat[];
}

export function ProgressAnalytics({ trend, dimensionStats, gaps }: ProgressAnalyticsProps) {
  return (
    <section className="space-y-5">
      <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Progress</h2>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <ScoreTrend points={trend} />
        </div>
        <div className="lg:col-span-2">
          <RecurringGaps gaps={gaps} />
        </div>
      </div>

      <DimensionMastery dimensionStats={dimensionStats} />
    </section>
  );
}

function Panel({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 h-full", className)}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
        {icon}
        <span className="font-medium">{title}</span>
      </div>
      {children}
    </div>
  );
}

// ── Score trend ────────────────────────────────────────────────────────────

function ScoreTrend({ points }: { points: TrendPoint[] }) {
  const [active, setActive] = useState<number | null>(null);

  const W = 320;
  const H = 130;
  const padX = 10;
  const padY = 14;
  const plotW = W - padX * 2;
  const plotH = H - padY * 2;

  const coords = points.map((p, i) => {
    const x = points.length > 1 ? padX + (i * plotW) / (points.length - 1) : W / 2;
    const y = padY + (1 - p.pct) * plotH;
    return { x, y, p };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const areaPath =
    coords.length > 1
      ? `${linePath} L ${coords[coords.length - 1].x} ${padY + plotH} L ${coords[0].x} ${padY + plotH} Z`
      : "";

  return (
    <Panel title="Score trend" icon={<TrendingUp className="w-3.5 h-3.5" />}>
      {points.length < 2 ? (
        <p className="text-xs text-muted-foreground py-8 text-center">
          Complete another interview to see your trend.
        </p>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto overflow-visible"
            onMouseLeave={() => setActive(null)}
          >
            {/* gridlines at 0/50/100% */}
            {[0, 0.5, 1].map((g) => (
              <line
                key={g}
                x1={padX}
                x2={W - padX}
                y1={padY + (1 - g) * plotH}
                y2={padY + (1 - g) * plotH}
                stroke="currentColor"
                strokeWidth={0.5}
                className="text-border"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {areaPath && <path d={areaPath} className="fill-primary/10" />}
            <path
              d={linePath}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="text-primary"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
            {coords.map((c, i) => (
              <circle
                key={i}
                cx={c.x}
                cy={c.y}
                r={active === i ? 5 : 3.5}
                fill={VERDICT_DOT[c.p.verdict] ?? "currentColor"}
                stroke="var(--color-card, #fff)"
                strokeWidth={1.5}
                className="cursor-pointer transition-[r]"
                onMouseEnter={() => setActive(i)}
              />
            ))}
          </svg>

          {active !== null && (
            <div className="mt-2 text-xs flex items-center justify-between gap-2 border-t border-border pt-2">
              <span className="truncate text-foreground font-medium">{coords[active].p.title}</span>
              <span className="shrink-0 font-mono text-muted-foreground">
                {coords[active].p.total}/{coords[active].p.max} · {coords[active].p.verdict}
              </span>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

// ── Dimension mastery ────────────────────────────────────────────────────────

function DimensionMastery({
  dimensionStats,
}: {
  dimensionStats: Record<string, DimensionStat[]>;
}) {
  const types = Object.keys(dimensionStats);
  if (types.length === 0) return null;

  return (
    <Panel title="Dimension mastery — weakest first" icon={<Target className="w-3.5 h-3.5" />}>
      <div className={cn("grid gap-x-8 gap-y-5", types.length > 1 ? "sm:grid-cols-2" : "")}>
        {types.map((type) => (
          <div key={type} className="space-y-2.5">
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground/70">
              {TYPE_LABEL[type] ?? type}
            </p>
            {dimensionStats[type].map((d) => {
              const ratio = d.max ? d.avg / d.max : 0;
              const color =
                ratio >= 0.75
                  ? "bg-green-400"
                  : ratio >= 0.5
                  ? "bg-yellow-400"
                  : "bg-red-400";
              return (
                <div key={d.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{d.label}</span>
                    <span className="font-mono text-muted-foreground tabular-nums">
                      {d.avg.toFixed(1)}/{d.max}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-[width]", color)}
                      style={{ width: `${Math.round(ratio * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── Recurring gaps ───────────────────────────────────────────────────────────

function RecurringGaps({ gaps }: { gaps: GapStat[] }) {
  return (
    <Panel title="Recurring gaps" icon={<AlertTriangle className="w-3.5 h-3.5" />}>
      {gaps.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8 text-center">
          No gaps flagged yet. Nice.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {gaps.map((g) => (
            <li key={g.topic} className="flex items-start gap-2 text-xs">
              {g.count > 1 && (
                <span className="shrink-0 mt-0.5 font-mono text-[10px] px-1.5 py-0.5 rounded bg-red-400/10 text-red-400 border border-red-400/20 tabular-nums">
                  ×{g.count}
                </span>
              )}
              <span className="text-muted-foreground leading-snug">{g.topic}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
