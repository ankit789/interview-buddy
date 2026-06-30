"use client";

import Link from "next/link";
import type { Problem } from "@/lib/types";
import { Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DIFFICULTY_PILL, TYPE_LABEL } from "@/lib/ui-tokens";

interface ProblemCardProps {
  problem: Problem;
  featured?: boolean;
}

export function ProblemCard({ problem, featured }: ProblemCardProps) {
  return (
    <Link
      href={`/interview/new?problem=${problem.id}`}
      prefetch={false}
      className={cn(
        "group relative flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-all duration-200",
        "[box-shadow:inset_0_1px_0_0_oklch(1_0_0/0.05)]",
        "hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/30",
        featured && "border-primary/20"
      )}
    >
      {/* Type + difficulty */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {TYPE_LABEL[problem.type] ?? problem.type}
        </span>
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wider",
            DIFFICULTY_PILL[problem.difficulty]
          )}
        >
          {problem.difficulty}
        </span>
      </div>

      {/* Title + description */}
      <div>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug transition-colors group-hover:text-primary">
          {problem.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {problem.description}
        </p>
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between pt-1">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span className="font-mono text-xs tabular-nums">{problem.timeMinutes}m</span>
        </div>
        <div className="flex items-center gap-1">
          {problem.companies.slice(0, 2).map((c) => (
            <span
              key={c}
              className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      <ChevronRight className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}
