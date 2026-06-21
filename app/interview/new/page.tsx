import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProblemById } from "@/lib/problems";
import { StartInterviewForm } from "./StartInterviewForm";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import Link from "next/link";

interface Props {
  searchParams: Promise<{ problem?: string }>;
}

export default async function NewInterviewPage({ searchParams }: Props) {
  const { problem: problemId } = await searchParams;

  if (!problemId) redirect("/");

  const problem = getProblemById(problemId);
  if (!problem) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← back
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg space-y-8">
          {/* Problem context */}
          <div className="space-y-1">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
              {problem.difficulty} · {problem.companies.length > 0 ? problem.companies.join(", ") : "General"}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">{problem.title}</h1>
            <p className="text-sm text-muted-foreground leading-relaxed pt-1">
              {problem.description}
            </p>
          </div>

          <StartInterviewForm problem={problem} />
        </div>
      </main>
    </div>
  );
}
