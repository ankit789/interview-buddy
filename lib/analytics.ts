import type { InterviewType, ReshadeScore, Verdict } from "./types";

// Each RESHADED-style dimension is scored 0-2 unless the stored record says
// otherwise. Totals differ by interview type (SD = 7 dims/14, LLD & behavioral
// = 5 dims/10), so we always derive the max from the scores rather than assume.
const DIM_MAX_DEFAULT = 2;

/** One completed, scored session — the unit all analytics aggregate over. */
export interface EvalRecord {
  date: string; // ISO timestamp the session was scored/created
  interviewType: InterviewType;
  title: string;
  total: number;
  verdict: Verdict;
  scores: ReshadeScore[];
  missed: string[];
  stalled: string[];
}

export function evalMaxTotal(scores: ReshadeScore[]): number {
  return scores.reduce((sum, s) => sum + (s.max ?? DIM_MAX_DEFAULT), 0);
}

export interface TrendPoint {
  date: string;
  title: string;
  type: InterviewType;
  total: number;
  max: number;
  pct: number; // 0..1, lets types with different maxes share one axis
  verdict: Verdict;
}

/** Chronological score history, normalized to a percentage for a shared axis. */
export function buildScoreTrend(records: EvalRecord[]): TrendPoint[] {
  return [...records]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((r) => {
      const max = evalMaxTotal(r.scores) || r.total || 1;
      return {
        date: r.date,
        title: r.title,
        type: r.interviewType,
        total: r.total,
        max,
        pct: max ? r.total / max : 0,
        verdict: r.verdict,
      };
    });
}

export interface DimensionStat {
  letter: string;
  label: string;
  avg: number;
  max: number;
  count: number;
}

/**
 * Per-dimension averages, grouped by interview type. Dimension sets differ
 * across types, so mixing them would be meaningless — each type gets its own
 * list, sorted weakest-first so the gaps surface at the top.
 */
export function buildDimensionStats(
  records: EvalRecord[]
): Record<string, DimensionStat[]> {
  const byType = new Map<
    string,
    Map<string, { label: string; letter: string; sum: number; max: number; count: number }>
  >();

  for (const r of records) {
    const map = byType.get(r.interviewType) ?? new Map();
    byType.set(r.interviewType, map);
    for (const s of r.scores) {
      const key = s.label ?? s.letter ?? "?";
      const entry =
        map.get(key) ?? { label: s.label ?? key, letter: s.letter ?? "", sum: 0, max: 0, count: 0 };
      entry.sum += s.score ?? 0;
      entry.max = s.max ?? DIM_MAX_DEFAULT;
      entry.count += 1;
      map.set(key, entry);
    }
  }

  const out: Record<string, DimensionStat[]> = {};
  for (const [type, map] of byType) {
    out[type] = [...map.values()]
      .map((e) => ({
        letter: e.letter,
        label: e.label,
        avg: e.count ? e.sum / e.count : 0,
        max: e.max,
        count: e.count,
      }))
      .sort((a, b) => a.avg / (a.max || 1) - b.avg / (b.max || 1));
  }
  return out;
}

export interface GapStat {
  topic: string;
  count: number;
}

/** Most-flagged gaps across sessions (missed + stalled topics), repeats first. */
export function buildRecurringGaps(records: EvalRecord[], topN = 10): GapStat[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    for (const g of [...(r.missed ?? []), ...(r.stalled ?? [])]) {
      const key = g.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic))
    .slice(0, topN);
}
