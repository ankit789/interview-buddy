import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProblemById } from "@/lib/problems";
import Link from "next/link";
import type { InterviewEvaluation } from "@/lib/types";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Kicker } from "@/components/ui/surface";
import { TYPE_FULL } from "@/lib/ui-tokens";
import { SessionReviewPane } from "@/components/interview/SessionReviewPane";
import {
  VerdictBadge,
  CapReason,
  SignalStats,
  DimensionBars,
  EvalList,
  Feedback,
} from "@/components/evaluation/eval-parts";

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function ResultPage({ params }: Props) {
  const { sessionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) notFound();

  const { data: evaluation } = await supabase
    .from("interview_evaluations")
    .select("*")
    .eq("session_id", sessionId)
    .single();

  if (!evaluation) {
    // Evaluation not ready yet — shouldn't happen but guard it
    redirect(`/interview/${sessionId}`);
  }

  // Full session transcript for the review pane.
  const { data: messages } = await supabase
    .from("interview_messages")
    .select("role, content, message_type")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const hasWhiteboard = session.interview_type === "system_design";

  const problem = getProblemById(session.problem_id);
  const ev = evaluation as InterviewEvaluation;

  const durationMs = session.completed_at
    ? new Date(session.completed_at).getTime() -
      new Date(session.created_at).getTime()
    : null;
  const durationMin = durationMs ? Math.round(durationMs / 60000) : null;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← interview-buddy
        </Link>
        <div className="flex items-center gap-3">
          <SessionReviewPane
            messages={messages ?? []}
            canvasState={session.canvas_state ?? null}
            hasWhiteboard={hasWhiteboard}
            codeState={session.code_state ?? null}
          />
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Dashboard
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10 space-y-10">
        {/* Session meta */}
        <div className="space-y-1.5">
          <Kicker>
            {TYPE_FULL[session.interview_type] ?? session.interview_type.replace("_", " ")} ·{" "}
            {session.difficulty}
            {durationMin ? ` · ${durationMin} min` : ""}
          </Kicker>
          <h1 className="text-3xl font-semibold tracking-tight">
            {problem?.title ?? session.problem_id}
          </h1>
        </div>

        {/* Verdict + total */}
        <VerdictBadge verdict={ev.verdict} total={ev.total} scores={ev.scores} />

        {/* Verdict cap callout */}
        <CapReason reason={ev.signals?.capReason} />

        {/* Session signals */}
        {ev.signals && <SignalStats signals={ev.signals} />}

        {/* Per-dimension breakdown */}
        <section>
          <DimensionBars scores={ev.scores} />
        </section>

        {/* Covered / Missed */}
        <section className="grid grid-cols-2 gap-6">
          <EvalList title="What you nailed" items={ev.covered} variant="covered" emptyDash />
          <EvalList title="What you missed" items={ev.missed} variant="missed" emptyDash />
        </section>

        {/* Where you stalled */}
        <EvalList title="Where you stalled" items={ev.stalled ?? []} variant="stalled" />

        {/* Feedback */}
        <Feedback text={ev.feedback} />

        {/* Study next */}
        <EvalList title="Study next" items={ev.study_next} variant="study" />

        {/* Actions */}
        <div className="flex gap-3 border-t border-border pt-6">
          <Link
            href={`/interview/new?problem=${session.problem_id}`}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            Practice again
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground [box-shadow:inset_0_1px_0_0_oklch(1_0_0/0.05)]"
          >
            New problem
          </Link>
        </div>
      </main>
    </div>
  );
}
