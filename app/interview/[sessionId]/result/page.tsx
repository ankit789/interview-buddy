import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProblemById } from "@/lib/problems";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { InterviewEvaluation } from "@/lib/types";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { SessionReviewPane } from "@/components/interview/SessionReviewPane";

interface Props {
  params: Promise<{ sessionId: string }>;
}

const verdictStyle: Record<string, string> = {
  "Strong Hire":
    "text-[oklch(0.68_0.18_145)] border-[oklch(0.68_0.18_145)]/40 bg-[oklch(0.68_0.18_145)]/10",
  Borderline:
    "text-[oklch(0.75_0.18_80)] border-[oklch(0.75_0.18_80)]/40 bg-[oklch(0.75_0.18_80)]/10",
  "Not Ready":
    "text-[oklch(0.65_0.20_25)] border-[oklch(0.65_0.20_25)]/40 bg-[oklch(0.65_0.20_25)]/10",
};

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
        <div className="space-y-1">
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
            {session.interview_type.replace("_", " ")} · {session.difficulty}
            {durationMin ? ` · ${durationMin} min` : ""}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {problem?.title ?? session.problem_id}
          </h1>
        </div>

        {/* Verdict + total */}
        <div className="flex items-center gap-4">
          <span
            className={cn(
              "px-4 py-1.5 rounded-full border font-mono text-sm font-medium",
              verdictStyle[ev.verdict] ?? ""
            )}
          >
            {ev.verdict}
          </span>
          <span className="font-mono text-2xl font-bold tabular-nums">
            {ev.total}
            <span className="text-muted-foreground text-lg font-normal">
              /{ev.scores.reduce((a, s) => a + (s.max ?? 2), 0)}
            </span>
          </span>
        </div>

        {/* Verdict cap callout */}
        {ev.signals?.capReason && (
          <div className="flex gap-2 text-xs text-[oklch(0.75_0.18_80)] bg-[oklch(0.75_0.18_80)]/10 border border-[oklch(0.75_0.18_80)]/30 rounded-md px-3 py-2 leading-relaxed">
            <span className="shrink-0">⚠</span>
            <span>{ev.signals.capReason}</span>
          </div>
        )}

        {/* Session signals */}
        {ev.signals && (
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SignalStat
              label="Hints taken"
              value={String(ev.signals.hintsTaken)}
              warn={ev.signals.hintsTaken >= 4}
            />
            <SignalStat
              label="You drove"
              value={`${Math.round(ev.signals.contributionRatio * 100)}%`}
              warn={ev.signals.contributionRatio < 0.3}
            />
            <SignalStat
              label="Answer-fishing"
              value={String(ev.signals.fishingCount)}
              warn={ev.signals.fishingCount >= 3}
            />
            <SignalStat label="Reached" value={ev.signals.maxPhaseLabel} />
          </section>
        )}

        {/* RESHADED bars */}
        <section className="space-y-3">
          {ev.scores.map((s) => {
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
                  <span className="text-xs text-foreground w-36 shrink-0">
                    {s.label}
                  </span>
                </div>
                {s.gap && (
                  <p className="text-xs text-muted-foreground pl-7 leading-relaxed">
                    {s.gap}
                  </p>
                )}
              </div>
            );
          })}
        </section>

        {/* Covered / Missed */}
        <section className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              What you nailed
            </h2>
            <ul className="space-y-1.5">
              {ev.covered.map((c, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-[oklch(0.68_0.18_145)] shrink-0 mt-0.5">
                    ✓
                  </span>
                  {c}
                </li>
              ))}
              {ev.covered.length === 0 && (
                <li className="text-sm text-muted-foreground">—</li>
              )}
            </ul>
          </div>
          <div className="space-y-2">
            <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              What you missed
            </h2>
            <ul className="space-y-1.5">
              {ev.missed.map((m, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-[oklch(0.65_0.20_25)] shrink-0 mt-0.5">
                    ✗
                  </span>
                  {m}
                </li>
              ))}
              {ev.missed.length === 0 && (
                <li className="text-sm text-muted-foreground">—</li>
              )}
            </ul>
          </div>
        </section>

        {/* Where you stalled */}
        {ev.stalled && ev.stalled.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Where you stalled
            </h2>
            <ul className="space-y-1.5">
              {ev.stalled.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-[oklch(0.75_0.18_80)] shrink-0 mt-0.5">•</span>
                  {s}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Feedback */}
        {ev.feedback && (
          <section className="space-y-2">
            <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Overall feedback
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground border-l-2 border-border pl-4">
              {ev.feedback}
            </p>
          </section>
        )}

        {/* Study next */}
        {ev.study_next.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Study next
            </h2>
            <ul className="space-y-1.5">
              {ev.study_next.map((t, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-primary shrink-0">→</span>
                  {t}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-border">
          <Link
            href={`/interview/new?problem=${session.problem_id}`}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/80 transition-colors"
          >
            Practice Again
          </Link>
          <Link
            href="/"
            className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-md hover:text-foreground hover:border-border/60 transition-colors"
          >
            New Problem
          </Link>
        </div>
      </main>
    </div>
  );
}

function SignalStat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-1",
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
