import { notFound } from "next/navigation";
import Link from "next/link";
import { getSimRun } from "@/lib/sim-runs";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { SimDetailView } from "@/components/sim/SimDetailView";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SimDetailPage({ params }: Props) {
  if (process.env.NODE_ENV === "production") notFound();

  const { id } = await params;
  const run = await getSimRun(id);
  if (!run) notFound();

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="border-b border-border px-4 sm:px-6 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/sim"
            className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            ← runs
          </Link>
          <span className="text-muted-foreground/40">|</span>
          <span className="font-mono text-xs text-primary shrink-0">{run.persona}</span>
          <span className="text-sm font-medium truncate">{run.problemTitle}</span>
        </div>
        <ThemeToggle />
      </header>

      <SimDetailView run={run} />
    </div>
  );
}
