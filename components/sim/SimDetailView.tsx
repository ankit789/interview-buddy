"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import type { SimResult } from "@/sim/engine";
import {
  VerdictBadge,
  SignalStats,
  DimensionBars,
  EvalList,
  Feedback,
  CapReason,
} from "@/components/evaluation/eval-parts";

const MIN_PCT = 30;
const MAX_PCT = 70;
const DEFAULT_PCT = 50;

// Markdown styling for transcript messages. Fenced blocks (the candidate's ASCII diagram)
// render in a monospace, tight-leading <pre> so boxes-and-arrows line up; inline code is pill-styled.
const MD = cn(
  "space-y-2 [&_p]:my-0 [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-4 [&_ul]:pl-4 [&_strong]:font-semibold",
  "[&_pre]:bg-muted [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:text-xs [&_pre]:leading-[1.15]",
  "[&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:rounded [&_:not(pre)>code]:text-xs"
);

export function SimDetailView({ run }: { run: SimResult }) {
  const { transcript, signals, evaluation, interviewerFlags } = run;
  const status = run.status ?? "completed";
  const isLive = status === "running" || status === "evaluating";

  const router = useRouter();
  // Live runs: re-fetch the server component every 2s so the transcript updates in place.
  useEffect(() => {
    if (!isLive) return;
    const t = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(t);
  }, [isLive, router]);

  // Auto-scroll the transcript to the newest message as it arrives.
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [transcript.length, status]);

  const lastRole = transcript[transcript.length - 1]?.role;
  const thinkingLabel =
    status === "evaluating"
      ? "evaluating…"
      : lastRole === "assistant"
      ? `${run.persona} candidate is thinking…`
      : "interviewer is thinking…";

  const [leftPct, setLeftPct] = useState(DEFAULT_PCT);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function onDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onMouseMove(e: MouseEvent) {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(MAX_PCT, Math.max(MIN_PCT, pct)));
    }
    function onMouseUp() {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  return (
    <div ref={containerRef} className="flex-1 flex overflow-hidden">
      {/* Transcript — independent scroll */}
      <div
        className="flex flex-col overflow-hidden"
        style={{ width: `${leftPct}%` }}
      >
        <div className="px-5 py-3 border-b border-border shrink-0">
          <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
            Transcript
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {transcript.map((m, i) => {
            const isUser = m.role === "user";
            return (
              <div key={i} className={cn("space-y-1", isUser && "pl-2")}>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                    {isUser ? "candidate" : "interviewer"}
                  </span>
                  {m.message_type === "hint" && (
                    <span className="font-mono text-[10px] text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded">
                      hint
                    </span>
                  )}
                </div>
                <div
                  className={cn(
                    "text-sm leading-relaxed",
                    isUser ? "text-muted-foreground" : "text-foreground",
                    MD
                  )}
                >
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            );
          })}

          {/* Live "thinking" indicator while a run is in progress */}
          {isLive && (
            <div className="flex items-center gap-2 text-xs font-mono text-primary pl-2">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
              </span>
              {thinkingLabel}
            </div>
          )}

          {/* Scroll anchor — auto-scrolled into view as messages arrive */}
          <div ref={transcriptEndRef} />
        </div>
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={onDividerMouseDown}
        className="w-1 shrink-0 bg-border hover:bg-primary/50 cursor-col-resize transition-colors relative group"
        title="Drag to resize"
      >
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="w-0.5 h-0.5 rounded-full bg-primary/80" />
          ))}
        </div>
      </div>

      {/* Evaluation — independent scroll */}
      <div
        className="flex flex-col overflow-hidden bg-card/30"
        style={{ width: `${100 - leftPct}%` }}
      >
        <div className="px-5 py-3 border-b border-border shrink-0 flex items-center gap-3">
          {evaluation ? (
            <VerdictBadge
              verdict={evaluation.verdict}
              total={evaluation.total}
              scores={evaluation.scores}
              rawVerdict={evaluation.rawVerdict}
              size="sm"
            />
          ) : (
            <span className="flex items-center gap-2 text-xs font-mono text-primary">
              {isLive && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              )}
              {status === "evaluating"
                ? "Evaluating…"
                : status === "failed"
                ? "Failed"
                : `In progress — ${transcript.length} msgs / ~${(run.totalTurns ?? 0) * 2} expected`}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {status === "failed" && run.error && (
            <div className="flex gap-2 text-xs text-red-400 bg-red-400/10 border border-red-400/30 rounded-md px-3 py-2 leading-relaxed">
              <span className="shrink-0">✗</span>
              <span>{run.error}</span>
            </div>
          )}

          <CapReason reason={evaluation?.capReason} />

          {interviewerFlags.length > 0 && (
            <div className="flex gap-2 text-xs text-orange-400 bg-orange-400/10 border border-orange-400/30 rounded-md px-3 py-2 leading-relaxed">
              <span className="shrink-0">⚑</span>
              <span>Interviewer flags: {interviewerFlags.join("; ")}</span>
            </div>
          )}

          {/* Signals are computed continuously, so show them even while running */}
          <SignalStats signals={signals} dense />

          {evaluation ? (
            <>
              <DimensionBars scores={evaluation.scores} />
              <EvalList title="What they nailed" items={evaluation.covered} variant="covered" />
              <EvalList title="What they missed" items={evaluation.missed} variant="missed" />
              <EvalList title="Where they stalled" items={evaluation.stalled ?? []} variant="stalled" />
              <Feedback text={evaluation.feedback} />
            </>
          ) : (
            status !== "failed" && (
              <p className="text-sm text-muted-foreground">
                Scores appear here once the interview finishes and the evaluator runs.
                {isLive && " This view refreshes automatically."}
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}
