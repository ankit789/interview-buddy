import { notFound } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { listSimRuns } from "@/lib/sim-runs";
import { cn } from "@/lib/utils";
import { FlaskConical, ChevronRight } from "lucide-react";

// Local-only tool — never exposed in production.
export const dynamic = "force-dynamic";

const verdictColor: Record<string, string> = {
  "Strong Hire": "text-green-400 bg-green-400/10 border-green-400/20",
  Borderline: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  "Not Ready": "text-red-400 bg-red-400/10 border-red-400/20",
};

export default async function SimIndexPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const runs = await listSimRuns();

  // Group by problem for readability.
  const byProblem = new Map<string, typeof runs>();
  for (const r of runs) {
    const list = byProblem.get(r.problemTitle) ?? [];
    list.push(r);
    byProblem.set(r.problemTitle, list);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 mx-auto w-full max-w-4xl px-4 sm:px-6 py-12 space-y-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Simulation Runs</h1>
            <span className="font-mono text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
              local only
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Persona-driven interview simulations from <code className="text-xs">sim/runs/</code>.
            Generate more with <code className="text-xs">npm run sim</code>.
          </p>
        </div>

        {runs.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            No runs yet. Run{" "}
            <code className="text-xs">CEREBRAS_API_KEY=… npm run sim</code> to generate some.
          </div>
        ) : (
          [...byProblem.entries()].map(([title, group]) => (
            <section key={title} className="space-y-2">
              <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                {title}
              </h2>
              <div className="space-y-2">
                {group.map((r) => (
                  <Link
                    key={r.id}
                    href={`/sim/${r.id}`}
                    className="group flex items-center gap-4 p-3.5 rounded-lg border border-border bg-card hover:border-border/60 hover:bg-card/80 transition-all"
                  >
                    <span className="font-mono text-xs text-foreground w-16 shrink-0">
                      {r.persona}
                    </span>
                    {r.status === "completed" ? (
                      <span
                        className={cn(
                          "text-xs font-mono px-2 py-0.5 rounded border shrink-0 w-24 text-center",
                          verdictColor[r.verdict] ?? "text-muted-foreground bg-muted border-border"
                        )}
                      >
                        {r.verdict}
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "text-xs font-mono px-2 py-0.5 rounded border shrink-0 w-24 text-center",
                          r.status === "failed"
                            ? "text-red-400 bg-red-400/10 border-red-400/20"
                            : "text-primary bg-primary/10 border-primary/20 animate-pulse"
                        )}
                      >
                        {r.status === "failed" ? "failed" : r.status === "evaluating" ? "evaluating…" : "running…"}
                      </span>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-1 min-w-0">
                      <span className="font-mono">score {r.total}</span>
                      <span className="font-mono">hints {r.hints}</span>
                      <span className="font-mono">fish {r.fishing}</span>
                      <span className="font-mono">drove {r.contributionPct}%</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </Link>
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  );
}
