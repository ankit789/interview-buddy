import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Surface, Kicker } from "@/components/ui/surface";
import { TYPE_LABEL, VERDICT_PILL, DIFFICULTY_TEXT } from "@/lib/ui-tokens";

export interface SessionItem {
  id: string;
  problem_id: string;
  interview_type: string;
  difficulty: string;
  status: string;
  created_at: string;
  title: string;
  total: number | null;
  verdict: string | null;
  maxTotal: number;
}

export function SessionList({
  label,
  sessions,
}: {
  label: string;
  sessions: SessionItem[];
}) {
  if (sessions.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <Kicker>{label}</Kicker>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">
          {sessions.length}
        </span>
      </div>

      <Surface className="divide-y divide-border overflow-hidden">
        {sessions.map((s) => (
          <SessionRow key={s.id} session={s} />
        ))}
      </Surface>
    </section>
  );
}

function SessionRow({ session }: { session: SessionItem }) {
  const href =
    session.status === "completed"
      ? `/interview/${session.id}/result`
      : `/interview/${session.id}`;

  return (
    <Link
      href={href}
      prefetch={false}
      className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40"
    >
      <span className="grid h-7 w-11 shrink-0 place-items-center rounded-md border border-border bg-muted/50 font-mono text-[9px] tracking-wider text-muted-foreground">
        {TYPE_LABEL[session.interview_type] ?? session.interview_type.slice(0, 4).toUpperCase()}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{session.title}</p>
        <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <span className="tabular-nums">
            {new Date(session.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className={cn(DIFFICULTY_TEXT[session.difficulty] ?? "text-muted-foreground")}>
            {session.difficulty}
          </span>
        </div>
      </div>

      {session.verdict ? (
        <span
          className={cn(
            "shrink-0 rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide",
            VERDICT_PILL[session.verdict] ?? "text-muted-foreground bg-muted border-border"
          )}
        >
          {session.verdict}
        </span>
      ) : session.status === "active" ? (
        <span className="shrink-0 font-mono text-[11px] text-primary">Resume →</span>
      ) : null}

      {session.total != null && (
        <span className="w-12 shrink-0 text-right font-mono text-sm font-semibold tabular-nums text-foreground">
          {session.total}
          <span className="text-muted-foreground/50">/{session.maxTotal}</span>
        </span>
      )}

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}
