import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { ProblemGrid } from "@/components/problems/ProblemGrid";
import { getAllProblems, getAllCompanies } from "@/lib/problems";
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
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-10 space-y-12">
        {/* Hero */}
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Mock Interviews
          </h1>
          <p className="text-muted-foreground text-sm max-w-lg">
            Practice System Design, LLD, and Behavioral interviews with an AI
            senior engineer. Get RESHADED-scored feedback at the end.
          </p>
        </div>

        {/* Featured — System Design spotlight */}
        {featured.length > 0 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold">Featured — System Design</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Most commonly asked in FAANG loops
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {featured.map((p) => (
                <FeaturedChip key={p.id} problem={p} />
              ))}
            </div>
          </section>
        )}

        {/* Full problem browser */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold">All Problems</h2>
          <ProblemGrid problems={problems} companies={companies} />
        </section>
      </main>
    </div>
  );
}

function FeaturedChip({ problem }: { problem: Problem }) {
  const diffColor =
    problem.difficulty === "Hard"
      ? "text-red-400"
      : problem.difficulty === "Medium"
      ? "text-yellow-400"
      : "text-green-400";

  return (
    <Link
      href={`/interview/new?problem=${problem.id}`}
      className="group flex flex-col justify-between h-28 rounded-lg border border-primary/20 bg-primary/5 p-3 hover:bg-primary/10 hover:border-primary/40 transition-all"
    >
      <span className="text-xs font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
        {problem.title}
      </span>
      <div className="flex items-center justify-between mt-auto pt-2">
        <span className="font-mono text-[10px] text-muted-foreground">
          {problem.companies[0] ?? ""}
        </span>
        <span className={`font-mono text-[10px] ${diffColor}`}>
          {problem.difficulty}
        </span>
      </div>
    </Link>
  );
}
