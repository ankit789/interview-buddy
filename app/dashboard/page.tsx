import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/server";
import { getProblemById } from "@/lib/problems";
import { Kicker } from "@/components/ui/surface";
import { Reveal } from "@/components/ui/reveal";
import { StatCard } from "@/components/dashboard/StatCard";
import { SessionList, type SessionItem } from "@/components/dashboard/SessionList";
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

  const toItem = (r: (typeof rows)[number]): SessionItem => ({
    id: r.id,
    problem_id: r.problem_id,
    interview_type: r.interview_type,
    difficulty: r.difficulty,
    status: r.status,
    created_at: r.created_at,
    title: r.problem?.title ?? r.problem_id,
    total: r.evaluation?.total ?? null,
    verdict: (r.evaluation?.verdict as string | undefined) ?? null,
    maxTotal: r.maxTotal,
  });

  const totalCompleted = completed.length;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 lg:py-14">
        {/* Header */}
        <Reveal className="flex items-end justify-between gap-4">
          <div className="space-y-1.5">
            <Kicker>Overview</Kicker>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Your interview history, calibrated against each rubric.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-muted [box-shadow:inset_0_1px_0_0_oklch(1_0_0/0.05)]"
          >
            <Plus className="h-4 w-4" />
            New interview
          </Link>
        </Reveal>

        {/* Empty state */}
        {rows.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-muted-foreground">
              You haven&apos;t run any interviews yet.
            </p>
            <Link
              href="/"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
            >
              Start practicing →
            </Link>
          </div>
        ) : (
          <div className="mt-10 space-y-10">
            {/* Stats */}
            {totalCompleted > 0 && (
              <Reveal index={1} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Completed" value={totalCompleted} tone="accent" hint="sessions" />
                <StatCard label="Strong Hire" value={verdictCounts["Strong Hire"]} total={totalCompleted} tone="emerald" />
                <StatCard label="Borderline" value={verdictCounts["Borderline"]} total={totalCompleted} tone="amber" />
                <StatCard label="Not Ready" value={verdictCounts["Not Ready"]} total={totalCompleted} tone="rose" />
              </Reveal>
            )}

            {/* Progress analytics */}
            {evalRecords.length > 0 && (
              <Reveal index={2} className="space-y-4">
                <Kicker>Progress</Kicker>
                <ProgressAnalytics trend={trend} dimensionStats={dimensionStats} gaps={gaps} />
              </Reveal>
            )}

            {/* Sessions */}
            {active.length > 0 && (
              <Reveal index={3}>
                <SessionList label="In progress" sessions={active.map(toItem)} />
              </Reveal>
            )}
            {completed.length > 0 && (
              <Reveal index={4}>
                <SessionList label="Completed" sessions={completed.map(toItem)} />
              </Reveal>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
