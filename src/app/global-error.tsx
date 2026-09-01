"use client";

// `error.tsx` cannot catch an error thrown by the ROOT layout itself
// (e.g. getSettings() throwing, a font/module failing to load) — only
// errors from children below it. `global-error.tsx` is Next's mechanism
// for that case, and it must render its own <html>/<body> because it
// fully replaces the root layout when it activates. Kept deliberately
// minimal (no Tailwind theme classes, no font variables, no DB calls) so
// it has the best chance of rendering even when something fairly
// fundamental broke.
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error-boundary]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#07060d",
          color: "#f4f2fb",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.75rem", marginBottom: "0.75rem" }}>Something went wrong</h1>
          <p style={{ opacity: 0.7, marginBottom: "1.5rem", maxWidth: 420 }}>
            The site hit an unexpected error while loading. Please try again.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: "#f5b942",
              color: "#07060d",
              border: "none",
              borderRadius: "0.75rem",
              padding: "0.75rem 1.75rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
