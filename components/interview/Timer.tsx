"use client";

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface TimerProps {
  totalMinutes: number;
}

export function Timer({ totalMinutes }: TimerProps) {
  const totalSeconds = totalMinutes * 60;
  const [remaining, setRemaining] = useState(totalSeconds);
  const [running, setRunning] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const pct = remaining / totalSeconds;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const display = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  return (
    <button
      onClick={() => setRunning((r) => !r)}
      className={cn(
        "font-mono text-sm tabular-nums px-2.5 py-1 rounded border transition-colors",
        pct > 0.25
          ? "text-muted-foreground border-border hover:text-foreground"
          : pct > 0.1
          ? "text-[oklch(0.75_0.18_80)] border-[oklch(0.75_0.18_80)]/40"
          : "text-[oklch(0.65_0.20_25)] border-[oklch(0.65_0.20_25)]/40 animate-pulse"
      )}
      title={running ? "Click to pause" : "Click to resume"}
    >
      {display}
    </button>
  );
}
