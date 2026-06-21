import Link from "next/link";
import { signOut } from "@/lib/actions";
import { ThemeToggle } from "./ThemeToggle";

async function getUser() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null;
  }
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user;
  } catch {
    return null;
  }
}

export async function Navbar() {
  const user = await getUser();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
            <span className="font-mono text-xs font-bold text-primary-foreground">
              ib
            </span>
          </div>
          <span className="font-mono text-xs text-muted-foreground tracking-widest uppercase group-hover:text-foreground transition-colors">
            interview-buddy
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {process.env.NODE_ENV !== "production" && (
            <Link
              href="/sim"
              className="px-3 py-1.5 text-sm text-primary hover:text-foreground transition-colors rounded-md hover:bg-muted font-mono text-xs"
            >
              sim
            </Link>
          )}
          <ThemeToggle />
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
              >
                Dashboard
              </Link>
              <Link
                href="/settings"
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
              >
                Settings
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
