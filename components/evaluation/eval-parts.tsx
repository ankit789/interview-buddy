import { cn } from "@/lib/utils";

// Shared presentational kit for rendering an evaluation result. Used by BOTH the real
// interview result page (server component) and the sim detail view (client component) so
// the two surfaces stay visually identical — change the scoring UI in one place.
//
// These are pure (no hooks/state), so they render in either a server or client tree. The
// data sources stay separate; only the pixels are shared.

// One verdict palette, shared (the product's oklch design-system colors).
export const VERDICT_STYLE: Record<string, string> = {
  "Strong Hire":
    "text-[oklch(0.68_0.18_145)] border-[oklch(0.68_0.18_145)]/40 bg-[oklch(0.68_0.18_145)]/10",
  Borderline:
    "text-[oklch(0.75_0.18_80)] border-[oklch(0.75_0.18_80)]/40 bg-[oklch(0.75_0.18_80)]/10",
  "Not Ready":
    "text-[oklch(0.65_0.20_25)] border-[oklch(0.65_0.20_25)]/40 bg-[oklch(0.65_0.20_25)]/10",
};

// Minimal score/signal shapes both ReshadeScore[] (real) and SimEvaluation.scores (sim) satisfy.
export interface DimScore {
  letter?: string;
  label: string;
  score: number;
  max?: number;
  gap?: string;
}
export interface SignalsLike {
  hintsTaken: number;
  contributionRatio: number;
  fishingCount: number;
  maxPhaseLabel: string;
}

export function evalMax(scores: { max?: number }[]): number {
  // Legacy 0-2 records carry max:2; new 0-3 records carry max:3. Fall back to 2 when absent.
  return scores.reduce((a, s) => a + (s.max ?? 2), 0);
}

export function VerdictBadge({
  verdict,
  total,
  scores,
  rawVerdict,
  size = "lg",
}: {
  verdict: string;
  total: number;
  scores: DimScore[];
  rawVerdict?: string;
  size?: "sm" | "lg";
}) {
  const max = evalMax(scores);
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "rounded-full border font-mono font-medium",
          size === "lg" ? "px-4 py-1.5 text-sm" : "px-3 py-1 text-xs",
          VERDICT_STYLE[verdict] ?? ""
        )}
      >
        {verdict}
      </span>
      <span
        className={cn(
          "font-mono font-bold tabular-nums",
          size === "lg" ? "text-2xl" : "text-lg"
        )}
      >
        {total}
        <span
          className={cn(
            "text-muted-foreground font-normal",
            size === "lg" ? "text-lg" : "text-sm"
          )}
        >
          /{max}
        </span>
      </span>
      {rawVerdict && rawVerdict !== verdict && (
        <span className="text-xs text-muted-foreground font-mono">raw: {rawVerdict}</span>
      )}
    </div>
  );
}

export function SignalStats({
  signals,
  dense = false,
}: {
  signals: SignalsLike;
  dense?: boolean;
}) {
  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-4", dense ? "gap-2" : "gap-3")}>
      <SignalStat label="Hints taken" value={String(signals.hintsTaken)} warn={signals.hintsTaken >= 4} dense={dense} />
      <SignalStat label="You drove" value={`${Math.round(signals.contributionRatio * 100)}%`} warn={signals.contributionRatio < 0.3} dense={dense} />
      <SignalStat label="Answer-fishing" value={String(signals.fishingCount)} warn={signals.fishingCount >= 3} dense={dense} />
      <SignalStat label="Reached" value={signals.maxPhaseLabel} dense={dense} />
    </div>
  );
}

function SignalStat({
  label,
  value,
  warn,
  dense,
}: {
  label: string;
  value: string;
  warn?: boolean;
  dense?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border space-y-1",
        dense ? "p-2.5" : "p-3",
        warn
          ? "border-[oklch(0.75_0.18_80)]/30 bg-[oklch(0.75_0.18_80)]/5"
          : "border-border bg-card"
      )}
    >
      <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
        {label}
      </p>
      <p
        className={cn(
          "text-sm font-semibold truncate",
          warn ? "text-[oklch(0.75_0.18_80)]" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function DimensionBars({ scores }: { scores: DimScore[] }) {
  return (
    <div className="space-y-3">
      {scores.map((s) => {
        const max = s.max ?? 2;
        const pct = (s.score / max) * 100;
        return (
          <div key={s.letter ?? s.label} className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-muted-foreground w-4 shrink-0">
                {(s.letter ?? "").replace("2", "")}
              </span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="font-mono text-xs tabular-nums w-8 text-right text-muted-foreground">
                {s.score}/{max}
              </span>
              <span className="text-xs text-foreground w-36 shrink-0">{s.label}</span>
            </div>
            {s.gap && (
              <p className="text-xs text-muted-foreground pl-7 leading-relaxed">{s.gap}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

const LIST_MARK = {
  covered: { mark: "✓", cls: "text-[oklch(0.68_0.18_145)]" },
  missed: { mark: "✗", cls: "text-[oklch(0.65_0.20_25)]" },
  stalled: { mark: "•", cls: "text-[oklch(0.75_0.18_80)]" },
  study: { mark: "→", cls: "text-primary" },
} as const;

export function EvalList({
  title,
  items,
  variant,
  emptyDash = false,
}: {
  title: string;
  items: string[];
  variant: keyof typeof LIST_MARK;
  emptyDash?: boolean;
}) {
  if ((!items || items.length === 0) && !emptyDash) return null;
  const { mark, cls } = LIST_MARK[variant];
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
        {title}
      </h3>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <span className={cn("shrink-0 mt-0.5", cls)}>{mark}</span>
            {it}
          </li>
        ))}
        {items.length === 0 && emptyDash && (
          <li className="text-sm text-muted-foreground">—</li>
        )}
      </ul>
    </div>
  );
}

export function Feedback({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
        Overall feedback
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground border-l-2 border-border pl-4">
        {text}
      </p>
    </div>
  );
}

export function CapReason({ reason }: { reason?: string | null }) {
  if (!reason) return null;
  return (
    <div className="flex gap-2 text-xs text-[oklch(0.75_0.18_80)] bg-[oklch(0.75_0.18_80)]/10 border border-[oklch(0.75_0.18_80)]/30 rounded-md px-3 py-2 leading-relaxed">
      <span className="shrink-0">⚠</span>
      <span>{reason}</span>
    </div>
  );
}
