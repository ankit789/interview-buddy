import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { ProblemGrid } from "@/components/problems/ProblemGrid";
import { getAllProblems, getAllCompanies } from "@/lib/problems";
import { Kicker } from "@/components/ui/surface";
import { Reveal } from "@/components/ui/reveal";
import { DIFFICULTY_TEXT } from "@/lib/ui-tokens";
import type { Problem } from "@/lib/types";

export default function HomePage() {
  const problems = getAllProblems();
  const companies = getAllCompanies();

  const featuredIds = [
    "rate-limiter",
    "twitter-feed",
    "youtube-netflix",
    "uber-lyft",
    "whatsapp-chat",
    "key-value-store",
  ];
  const featured = featuredIds
    .map((id) => problems.find((p) => p.id === id))
    .filter((p): p is Problem => !!p);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-12 px-4 py-12 sm:px-6">
        {/* Hero */}
        <Reveal className="space-y-2">
          <Kicker>Practice</Kicker>
          <h1 className="text-3xl font-semibold tracking-tight">Mock interviews</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Run System Design, LLD, Behavioral, and SDET interviews against an AI senior
            engineer. Get rubric-scored, calibrated feedback the moment you wrap.
          </p>
        </Reveal>

        {/* Featured — System Design spotlight */}
        {featured.length > 0 && (
          <Reveal index={1} className="space-y-4">
            <div className="flex items-baseline justify-between">
              <Kicker>Featured · System Design</Kicker>
              <span className="text-xs text-muted-foreground">Most asked in FAANG loops</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {featured.map((p) => (
                <FeaturedChip key={p.id} problem={p} />
              ))}
            </div>
          </Reveal>
        )}

        {/* Full problem browser */}
        <Reveal index={2} className="space-y-4">
          <Kicker>All problems</Kicker>
          <ProblemGrid problems={problems} companies={companies} />
        </Reveal>
      </main>
    </div>
  );
}

function FeaturedChip({ problem }: { problem: Problem }) {
  return (
    <Link
      href={`/interview/new?problem=${problem.id}`}
      prefetch={false}
      className="group flex h-28 flex-col justify-between rounded-2xl border border-primary/20 bg-primary/[0.06] p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/10 [box-shadow:inset_0_1px_0_0_oklch(1_0_0/0.05)]"
    >
      <span className="line-clamp-2 text-xs font-semibold leading-snug transition-colors group-hover:text-primary">
        {problem.title}
      </span>
      <div className="mt-auto flex items-center justify-between pt-2">
        <span className="font-mono text-[10px] text-muted-foreground">
          {problem.companies[0] ?? ""}
        </span>
        <span className={`font-mono text-[10px] ${DIFFICULTY_TEXT[problem.difficulty] ?? ""}`}>
          {problem.difficulty}
        </span>
      </div>
    </Link>
  );
}
