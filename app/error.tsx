"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";

// Route-level error boundary. Catches thrown errors in any segment below the
// root layout (a Supabase blip, a render error) and offers recovery instead of
// dropping the user on a bare crash page.
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for server logs / monitoring; never leak details to the UI.
    console.error("Route error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Something broke
      </span>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        We hit an unexpected error
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        This one&apos;s on us. Try again — if it keeps happening, head back home and
        retry in a moment.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-[10px] text-muted-foreground/50">
          ref: {error.digest}
        </p>
      )}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
        >
          <RotateCw className="h-4 w-4" />
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground [box-shadow:inset_0_1px_0_0_oklch(1_0_0/0.05)]"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
