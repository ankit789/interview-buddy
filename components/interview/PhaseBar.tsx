"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface PhaseBarProps {
  phases: string[];
  currentPhase: number; // 0-indexed
}

export function PhaseBar({ phases, currentPhase }: PhaseBarProps) {
  return (
    <div className="flex items-center gap-1">
      {phases.map((phase, i) => {
        const done = i < currentPhase;
        const active = i === currentPhase;
        return (
          <div key={phase} className="flex items-center gap-1">
            <div
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono transition-all",
                done && "text-muted-foreground",
                active && "bg-primary/15 text-primary border border-primary/30",
                !done && !active && "text-muted-foreground/40"
              )}
            >
              {done ? (
                <Check className="w-3 h-3" />
              ) : (
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    active ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                />
              )}
              <span>{phase}</span>
            </div>
            {i < phases.length - 1 && (
              <div
                className={cn(
                  "w-4 h-px",
                  i < currentPhase ? "bg-muted-foreground/40" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
