"use client";

import { useState, useMemo } from "react";
import { ProblemCard } from "./ProblemCard";
import { Badge } from "@/components/ui/badge";
import type { Problem, InterviewType, Difficulty } from "@/lib/types";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProblemGridProps {
  problems: Problem[];
  companies: string[];
}

const TYPE_TABS: { value: InterviewType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "system_design", label: "System Design" },
  { value: "lld", label: "LLD" },
  { value: "behavioral", label: "Behavioral" },
  { value: "sdet_test_design", label: "SDET Test" },
  { value: "sdet_framework_design", label: "SDET Framework" },
];

const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard"];

export function ProblemGrid({ problems, companies }: ProblemGridProps) {
  const [tab, setTab] = useState<InterviewType | "all">("system_design");
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const [company, setCompany] = useState<string | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return problems.filter((p) => {
      if (tab !== "all" && p.type !== tab) return false;
      if (difficulty !== "all" && p.difficulty !== difficulty) return false;
      if (company !== "all" && !p.companies.includes(company)) return false;
      if (query) {
        const q = query.toLowerCase();
        if (
          !p.title.toLowerCase().includes(q) &&
          !p.description.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [problems, tab, difficulty, company, query]);

  const hasFilters =
    difficulty !== "all" || company !== "all" || query.length > 0;

  return (
    <div className="space-y-6">
      {/* Type tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {TYPE_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors relative",
              tab === t.value
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {tab === t.value && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search problems…"
            className="w-full h-9 pl-8 pr-3 text-sm bg-input border border-border rounded-md outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Difficulty */}
        <div className="flex items-center gap-1">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(difficulty === d ? "all" : d)}
              className={cn(
                "h-9 px-3 text-xs font-mono rounded-md border transition-colors",
                difficulty === d
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
              )}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Company */}
        <select
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="h-9 px-3 text-sm bg-input border border-border rounded-md outline-none focus:border-primary/60 text-muted-foreground transition-colors"
        >
          <option value="all">All companies</option>
          {companies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* Clear */}
        {hasFilters && (
          <button
            onClick={() => {
              setDifficulty("all");
              setCompany("all");
              setQuery("");
            }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}

        <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
          {filtered.length} problems
        </span>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No problems match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <ProblemCard key={p.id} problem={p} />
          ))}
        </div>
      )}
    </div>
  );
}
