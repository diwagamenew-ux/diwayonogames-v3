/**
 * Next.js instrumentation hook — runs once when the server starts.
 *
 * Safe by construction: it will CREATE tables via drizzle's migrator only
 * when it has positively confirmed the core tables don't exist, and it will
 * seed demo content only when the `users` table is confirmed empty. It will
 * never drop, truncate, or overwrite existing tables/data — see
 * src/db/seed.ts (ensureSchema / checkCoreTables) for the guarantee.
 * Retries a few times to ride out transient DB-connect races on cold starts
 * (Supabase / Neon / Vercel serverless) — a retry here just means "try the
 * read-only check again," not "try wiping the database again."
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const backoff = [0, 800, 2500, 6000];
    for (let attempt = 0; attempt < backoff.length; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, backoff[attempt]));
      try {
        const { bootstrapDatabase } = await import("./db/seed");
        await bootstrapDatabase();
        return;
      } catch (err) {
        console.error(`[bootstrap] attempt ${attempt + 1} failed:`, err);
      }
    }
    console.error("[bootstrap] giving up — /api/health will retry on next hit");
  }
}
