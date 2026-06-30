"use client";

import { useState } from "react";
import { TrendingUp, Target, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/surface";
import type { TrendPoint, DimensionStat, GapStat } from "@/lib/analytics";

const TYPE_LABEL: Record<string, string> = {
  system_design: "System Design",
  lld: "Low-Level Design",
  behavioral: "Behavioral",
  sdet_test_design: "SDET — Test Design",
  sdet_framework_design: "SDET — Framework Design",
};

// Verdict → fill color (fixed palette so it reads identically on the chart and pills).
const VERDICT_FILL: Record<string, string> = {
  "Strong Hire": "#34d399", // emerald-400
  Borderline: "#fbbf24", // amber-400
  "Not Ready": "#fb7185", // rose-400
};

const ACCENT = "oklch(0.68 0.18 250)";

interface ProgressAnalyticsProps {
  trend: TrendPoint[];
  dimensionStats: Record<string, DimensionStat[]>;
  gaps: GapStat[];
}

export function ProgressAnalytics({ trend, dimensionStats, gaps }: ProgressAnalyticsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ScoreTrend points={trend} />
        </div>
        <div className="lg:col-span-2">
          <RecurringGaps gaps={gaps} />
        </div>
      </div>
      <DimensionMastery dimensionStats={dimensionStats} />
    </div>
  );
}

// ── Score trend ──────────────────────────────────────────────────────────────

function ScoreTrend({ points }: { points: TrendPoint[] }) {
  const [active, setActive] = useState<number | null>(null);

  const W = 480;
  const H = 168;
  const padX = 14;
  const padY = 18;
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

  const last = points[points.length - 1];

  return (
    <Panel
      title="Score trend"
      icon={<TrendingUp className="h-3.5 w-3.5" />}
      action={
        last ? (
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            latest{" "}
            <span className="font-semibold text-foreground">
              {Math.round(last.pct * 100)}%
            </span>
          </span>
        ) : null
      }
    >
      {points.length < 2 ? (
        <p className="py-10 text-center text-xs text-muted-foreground">
          Complete another interview to chart your trend.
        </p>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full overflow-visible"
            onMouseLeave={() => setActive(null)}
          >
            <defs>
              <linearGradient id="ib-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity="0.22" />
                <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* gridlines + axis labels at 0 / 50 / 100% */}
            {[0, 0.5, 1].map((g) => {
              const y = padY + (1 - g) * plotH;
              return (
                <g key={g}>
                  <line
                    x1={padX}
                    x2={W - padX}
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    strokeWidth={0.5}
                    strokeDasharray="2 3"
                    className="text-border"
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={W - padX + 2}
                    y={y + 3}
                    className="fill-muted-foreground font-mono text-[8px]"
                  >
                    {g * 100}
                  </text>
                </g>
              );
            })}

            {areaPath && <path d={areaPath} fill="url(#ib-area)" />}

            <path
              d={linePath}
              fill="none"
              stroke={ACCENT}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              pathLength={1}
              className="ib-draw"
              style={{ filter: `drop-shadow(0 0 5px oklch(0.68 0.18 250 / 0.5))` }}
            />

            {/* crosshair on hover */}
            {active !== null && (
              <line
                x1={coords[active].x}
                x2={coords[active].x}
                y1={padY}
                y2={padY + plotH}
                stroke={ACCENT}
                strokeWidth={1}
                strokeOpacity={0.4}
                vectorEffect="non-scaling-stroke"
              />
            )}

            {coords.map((c, i) => {
              const fill = VERDICT_FILL[c.p.verdict] ?? ACCENT;
              return (
                <g key={i}>
                  {active === i && (
                    <circle cx={c.x} cy={c.y} r={8} fill={fill} fillOpacity={0.18} />
                  )}
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={active === i ? 4.5 : 3}
                    fill={fill}
                    stroke="var(--card)"
                    strokeWidth={1.5}
                    className="cursor-pointer transition-[r]"
                    onMouseEnter={() => setActive(i)}
                  />
                </g>
              );
            })}
          </svg>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3 text-xs">
            {active !== null ? (
              <>
                <span className="truncate font-medium text-foreground">
                  {coords[active].p.title}
                </span>
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                  {coords[active].p.total}/{coords[active].p.max} ·{" "}
                  <span style={{ color: VERDICT_FILL[coords[active].p.verdict] }}>
                    {coords[active].p.verdict}
                  </span>
                </span>
              </>
            ) : (
              <span className="font-mono text-[11px] text-muted-foreground/60">
                hover a point for detail
              </span>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

// ── Dimension mastery ──────────────────────────────────────────────────────────

function DimensionMastery({
  dimensionStats,
}: {
  dimensionStats: Record<string, DimensionStat[]>;
}) {
  const types = Object.keys(dimensionStats);
  if (types.length === 0) return null;

  return (
    <Panel title="Dimension mastery — weakest first" icon={<Target className="h-3.5 w-3.5" />}>
      <div className={cn("grid gap-x-10 gap-y-6", types.length > 1 ? "sm:grid-cols-2" : "")}>
        {types.map((type) => (
          <div key={type} className="space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">
              {TYPE_LABEL[type] ?? type}
            </p>
            <div className="space-y-3">
              {dimensionStats[type].map((d, i) => {
                const ratio = d.max ? d.avg / d.max : 0;
                const color =
                  ratio >= 0.75
                    ? "bg-emerald-400"
                    : ratio >= 0.5
                    ? "bg-amber-400"
                    : "bg-rose-400";
                return (
                  <div key={d.label} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate text-foreground/90">{d.label}</span>
                      <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                        {d.avg.toFixed(1)}
                        <span className="text-muted-foreground/50">/{d.max}</span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("ib-bar h-full rounded-full", color)}
                        style={{
                          width: `${Math.round(ratio * 100)}%`,
                          ["--ib-delay" as string]: `${i * 70}ms`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── Recurring gaps ───────────────────────────────────────────────────────────

function RecurringGaps({ gaps }: { gaps: GapStat[] }) {
  return (
    <Panel title="Recurring gaps" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
      {gaps.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center py-8 text-center">
          <p className="text-xs text-muted-foreground">No recurring gaps flagged.</p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">clean sheet — nice.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {gaps.map((g) => (
            <li key={g.topic} className="flex items-start gap-2.5 text-xs">
              <span
                className={cn(
                  "mt-px shrink-0 rounded font-mono text-[10px] tabular-nums",
                  g.count > 1
                    ? "border border-rose-400/20 bg-rose-400/10 px-1.5 py-0.5 text-rose-400"
                    : "px-1 py-0.5 text-muted-foreground/50"
                )}
              >
                {g.count > 1 ? `×${g.count}` : "·"}
              </span>
              <span className="leading-snug text-muted-foreground">{g.topic}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
