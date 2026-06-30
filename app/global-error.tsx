"use client";

import { useEffect } from "react";

// Last-resort boundary: catches errors in the root layout itself. It must render
// its own <html>/<body> because it replaces the root layout. Kept dependency-free
// and inline-styled so it works even if app chrome failed to load.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          background: "oklch(0.10 0 0)",
          color: "oklch(0.92 0 0)",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          textAlign: "center",
          padding: "1rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: "0.875rem", color: "oklch(0.55 0 0)", maxWidth: "24rem" }}>
          The app failed to load. Please reload the page.
        </p>
        <button
          onClick={reset}
          style={{
            border: "none",
            borderRadius: "0.5rem",
            background: "oklch(0.68 0.18 250)",
            color: "oklch(0.10 0 0)",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
