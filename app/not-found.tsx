import Link from "next/link";

// 404 surface — server component, matches the Calibrated language.
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <span className="font-mono text-5xl font-semibold tabular-nums text-primary [text-shadow:0_0_28px_oklch(0.68_0.18_250/0.5)]">
        404
      </span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        That page doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Link
          href="/"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
        >
          Browse problems
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground [box-shadow:inset_0_1px_0_0_oklch(1_0_0/0.05)]"
        >
          Dashboard
        </Link>
      </div>
    </main>
  );
}
