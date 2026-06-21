"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Problem } from "@/lib/types";
import { Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const difficultyColor: Record<string, string> = {
  Easy: "text-[oklch(0.68_0.18_145)] border-[oklch(0.68_0.18_145)]/30",
  Medium: "text-[oklch(0.75_0.18_80)] border-[oklch(0.75_0.18_80)]/30",
  Hard: "text-[oklch(0.65_0.20_25)] border-[oklch(0.65_0.20_25)]/30",
};

const typeLabel: Record<string, string> = {
  system_design: "SD",
  lld: "LLD",
  behavioral: "BEH",
};

interface ProblemCardProps {
  problem: Problem;
  featured?: boolean;
}

export function ProblemCard({ problem, featured }: ProblemCardProps) {
  return (
    <Link
      href={`/interview/new?problem=${problem.id}`}
      className={cn(
        "group relative flex flex-col gap-3 rounded-lg border border-border bg-card p-4",
        "hover:border-primary/40 hover:bg-card/80 transition-all duration-150",
        featured && "border-primary/20"
      )}
    >
      {/* Type chip */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">
          {typeLabel[problem.type]}
        </span>
        <span
          className={cn(
            "font-mono text-[10px] tracking-wider border rounded px-1.5 py-0.5",
            difficultyColor[problem.difficulty]
          )}
        >
          {problem.difficulty}
        </span>
      </div>

      {/* Title */}
      <div>
        <h3 className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
          {problem.title}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {problem.description}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span className="text-xs font-mono">{problem.timeMinutes}m</span>
        </div>
        <div className="flex items-center gap-1">
          {problem.companies.slice(0, 2).map((c) => (
            <span
              key={c}
              className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* Hover arrow */}
      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}
