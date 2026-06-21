import { redirect } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/server";
import { getProblemById } from "@/lib/problems";
import { Clock, ChevronRight, BarChart2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressAnalytics } from "@/components/dashboard/ProgressAnalytics";
import {
  buildScoreTrend,
  buildDimensionStats,
  buildRecurringGaps,
  evalMaxTotal,
  type EvalRecord,
} from "@/lib/analytics";
import type { InterviewType, ReshadeScore, Verdict } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sessions } = await supabase
    .from("interview_sessions")
    .select(`
      id, problem_id, interview_type, difficulty, status, created_at, completed_at,
      interview_evaluations (total, verdict, scores, missed, stalled)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (sessions ?? []).map((s) => {
    const problem = getProblemById(s.problem_id);
    const evaluation = Array.isArray(s.interview_evaluations)
      ? s.interview_evaluations[0]
      : s.interview_evaluations;
    const scores = (evaluation?.scores as ReshadeScore[] | undefined) ?? [];
    const maxTotal = scores.length ? evalMaxTotal(scores) : 14;
    return { ...s, problem, evaluation, maxTotal };
  });

  const completed = rows.filter((r) => r.status === "completed");
  const active = rows.filter((r) => r.status === "active");

  const verdictCounts = { "Strong Hire": 0, Borderline: 0, "Not Ready": 0 };
  for (const r of completed) {
    const v = r.evaluation?.verdict as keyof typeof verdictCounts | undefined;
    if (v && v in verdictCounts) verdictCounts[v]++;
  }

  // Build analytics from completed, scored sessions.
  const evalRecords: EvalRecord[] = completed
    .filter((r) => r.evaluation)
    .map((r) => ({
      date: r.completed_at ?? r.created_at,
      interviewType: r.interview_type as InterviewType,
      title: r.problem?.title ?? r.problem_id,
      total: r.evaluation!.total ?? 0,
      verdict: r.evaluation!.verdict as Verdict,
      scores: (r.evaluation!.scores as ReshadeScore[] | undefined) ?? [],
      missed: (r.evaluation!.missed as string[] | undefined) ?? [],
      stalled: (r.evaluation!.stalled as string[] | undefined) ?? [],
    }));

  const trend = buildScoreTrend(evalRecords);
  const dimensionStats = buildDimensionStats(evalRecords);
  const gaps = buildRecurringGaps(evalRecords);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-12 space-y-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your interview history and progress.</p>
        </div>

        {/* Stats */}
        {completed.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Completed" value={completed.length} icon={<BarChart2 className="w-4 h-4" />} />
            <StatCard label="Strong Hire" value={verdictCounts["Strong Hire"]} icon={<Trophy className="w-4 h-4" />} accent />
            <StatCard label="Borderline" value={verdictCounts["Borderline"]} icon={<Trophy className="w-4 h-4" />} />
            <StatCard label="Not Ready" value={verdictCounts["Not Ready"]} icon={<Trophy className="w-4 h-4" />} />
          </div>
        )}

        {/* Progress analytics */}
        {evalRecords.length > 0 && (
          <ProgressAnalytics trend={trend} dimensionStats={dimensionStats} gaps={gaps} />
        )}

        {/* In progress */}
        {active.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">In Progress</h2>
            <div className="space-y-2">
              {active.map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {rows.length === 0 && (
          <div className="py-20 flex flex-col items-center gap-4 text-center">
            <p className="text-muted-foreground text-sm">You haven't done any interviews yet.</p>
            <Link
              href="/"
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/80 transition-colors"
            >
              Start practicing →
            </Link>
          </div>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Completed</h2>
            <div className="space-y-2">
              {completed.map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function SessionRow({ session }: { session: ReturnType<typeof buildRow> }) {
  const typeLabel: Record<string, string> = {
    system_design: "SD",
    lld: "LLD",
    behavioral: "BEH",
  };
  const verdict = session.evaluation?.verdict;
  const verdictColor =
    verdict === "Strong Hire"
      ? "text-green-400 bg-green-400/10 border-green-400/20"
      : verdict === "Borderline"
      ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/20"
      : verdict === "Not Ready"
      ? "text-red-400 bg-red-400/10 border-red-400/20"
      : "text-muted-foreground bg-muted border-border";

  const href =
    session.status === "completed"
      ? `/interview/${session.id}/result`
      : `/interview/${session.id}`;

  return (
    <Link
      href={href}
      className="group flex items-center gap-4 p-3.5 rounded-lg border border-border bg-card hover:border-border/60 hover:bg-card/80 transition-all"
    >
      <span className="font-mono text-[10px] text-muted-foreground w-8 shrink-0">
        {typeLabel[session.interview_type] ?? session.interview_type}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {session.problem?.title ?? session.problem_id}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {new Date(session.created_at).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            })}
          </span>
          <DifficultyBadge difficulty={session.difficulty} />
        </div>
      </div>

      {verdict ? (
        <span className={cn("text-xs font-mono px-2 py-0.5 rounded border shrink-0", verdictColor)}>
          {verdict}
        </span>
      ) : session.status === "active" ? (
        <span className="text-xs font-mono text-primary shrink-0">Resume →</span>
      ) : null}

      {session.evaluation?.total != null && (
        <span className="font-mono text-sm font-semibold text-muted-foreground shrink-0 w-12 text-right">
          {session.evaluation.total}/{session.maxTotal}
        </span>
      )}

      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </Link>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const color =
    difficulty === "Hard"
      ? "text-red-400"
      : difficulty === "Medium"
      ? "text-yellow-400"
      : "text-green-400";
  return <span className={cn("text-xs font-mono", color)}>{difficulty}</span>;
}

function StatCard({
  label, value, icon, accent,
}: {
  label: string; value: number; icon: React.ReactNode; accent?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-lg border p-4 space-y-2",
      accent ? "border-primary/30 bg-primary/5" : "border-border bg-card"
    )}>
      <div className={cn("flex items-center gap-1.5 text-xs", accent ? "text-primary" : "text-muted-foreground")}>
        {icon}
        {label}
      </div>
      <p className={cn("text-2xl font-semibold tabular-nums", accent ? "text-primary" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}

// Local helper to satisfy TypeScript for the session shape
type BuildRowResult = {
  id: string;
  problem_id: string;
  interview_type: string;
  difficulty: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  problem: ReturnType<typeof getProblemById>;
  evaluation: { total: number; verdict: string } | undefined;
  maxTotal: number;
};
function buildRow(_: unknown): BuildRowResult { return _ as BuildRowResult; }
