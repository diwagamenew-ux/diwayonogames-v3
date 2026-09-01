"use client";

// Segment error boundary. Next.js renders this automatically whenever a
// Server or Client Component below the root layout throws during render —
// WITHOUT this file, that error falls through to Next's built-in fallback,
// which in production is a blank page with just the words "Application
// error: a client-side exception has occurred" and no way back to the
// site. That's a dead end for a real visitor and it happens silently (no
// error is ever recorded anywhere).
//
// This intentionally stays a plain, dependency-free client component: it
// must be able to render even when the error was thrown by something this
// page's own imports depend on.
import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Minimum viable server-side visibility: logs land in the hosting
    // platform's function logs (Vercel/DreamHost) even though there's no
    // external error tracker wired up. Swap this for Sentry/etc. later
    // without touching the rest of this file.
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <p className="font-display text-6xl sm:text-7xl gold-text leading-none">OOPS</p>
      <h1 className="font-display text-2xl sm:text-3xl tracking-wide mt-3">SOMETHING WENT WRONG</h1>
      <p className="text-mute mt-3 max-w-md mx-auto text-sm leading-relaxed">
        This page hit an unexpected error. It has been logged — try again, or head back to the
        homepage.
      </p>
      <div className="flex items-center justify-center gap-3 mt-7">
        <button onClick={() => reset()} className="btn-gold inline-flex px-7 py-3 text-sm">
          Try again
        </button>
        <a href="/" className="inline-flex px-7 py-3 text-sm rounded-xl border border-line hover:bg-panel2 transition-colors">
          Back to Home
        </a>
      </div>
    </div>
  );
}
