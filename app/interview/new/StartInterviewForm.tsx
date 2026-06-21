"use client";

import { useState, useTransition } from "react";
import { createSession } from "./actions";
import type { Problem, InterviewType, InterviewLevel } from "@/lib/types";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_META: Record<InterviewType, { label: string; description: string }> = {
  system_design: {
    label: "System Design",
    description: "High-level architecture, scalability, trade-offs",
  },
  lld: {
    label: "Low-Level Design",
    description: "Class design, OOP patterns, API contracts",
  },
  behavioral: {
    label: "Behavioral",
    description: "STAR format, leadership principles, past experience",
  },
};

const LEVELS: { id: InterviewLevel; label: string; description: string }[] = [
  { id: "mid", label: "Mid (L4)", description: "Correct, working design; happy path" },
  { id: "senior", label: "Senior (L5)", description: "Drives design, deep dives, trade-offs" },
  { id: "staff", label: "Staff (L6)", description: "Operational maturity, breadth, judgment" },
];

interface Props {
  problem: Problem;
}

export function StartInterviewForm({ problem }: Props) {
  const [pending, startTransition] = useTransition();
  const [level, setLevel] = useState<InterviewLevel>("senior");
  const meta = TYPE_META[problem.type];

  function handleStart() {
    startTransition(async () => {
      await createSession(problem.id, level);
    });
  }

  return (
    <div className="space-y-6">
      {/* Interview type — derived from the problem, not chosen */}
      <div className="space-y-2">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
          Interview format
        </p>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-sm font-medium text-foreground">{meta.label}</p>
          <p className="text-xs mt-0.5 text-muted-foreground">{meta.description}</p>
        </div>
      </div>

      {/* Target level — a real choice: it sets the bar you're scored against */}
      <div className="space-y-2">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
          Target level
        </p>
        <div className="grid grid-cols-3 gap-2">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLevel(l.id)}
              disabled={pending}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left transition-colors",
                level === l.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-border/60"
              )}
            >
              <p className={cn("text-sm font-medium", level === l.id ? "text-primary" : "text-foreground")}>
                {l.label}
              </p>
              <p className="text-[11px] mt-0.5 text-muted-foreground leading-snug">{l.description}</p>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          You'll be scored against this bar — the same answer can be Strong Hire at Mid and Borderline at Staff.
        </p>
      </div>

      <button
        onClick={handleStart}
        disabled={pending}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/80 transition-colors disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Starting…
          </>
        ) : (
          "Start Interview →"
        )}
      </button>
    </div>
  );
}
