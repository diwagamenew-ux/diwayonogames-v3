import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    // node-postgres defaults `max` to 10 per Pool instance. On serverless
    // hosting (Vercel), many function instances can run concurrently, each
    // creating its own Pool — with no cap that can add up to far more
    // connections than Supabase's pooler (or plain Postgres) allows,
    // producing intermittent "too many connections" errors under load.
    // A small per-instance ceiling plus short idle/connect timeouts keeps
    // each instance's footprint bounded and releases idle connections
    // quickly instead of holding them open.
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

// CRITICAL — do not remove.
//
// node-postgres's Pool is an EventEmitter, and a client that is sitting
// idle in the pool can have its underlying TCP connection closed out from
// under it at any time — by Postgres itself, by a network blip, or (very
// commonly, and expected) by Supabase's Transaction Pooler (Supavisor)
// recycling connections, which is standard behavior for pgbouncer-style
// poolers and exactly why the pooler URL is recommended for serverless in
// the first place.
//
// When that happens, node-postgres emits an "error" event ON THE POOL
// OBJECT for that idle client. Node's EventEmitter contract is that an
// "error" event with no listener is NOT silently dropped — it is thrown
// as an uncaught exception. In a long-running server that just crashes
// the process and you notice immediately; on Vercel, it can crash/corrupt
// the *warm, reused* serverless function instance for whichever request
// happens to be in flight (or the very next one), which is why this
// previously surfaced as: first login after a fresh deploy works, then a
// LATER login (after the idle connection between requests gets dropped)
// fails with a raw 500 and no useful error — the process died before the
// route handler's own try/catch could even run.
//
// Listening here doesn't prevent the underlying connection from being
// dropped — that's normal, expected pooler behavior — it just tells
// node-postgres "I've handled this," so it quietly discards that one dead
// client and the *next* query transparently gets a fresh connection from
// the pool instead of taking the whole process down with it.
pool.on("error", (err) => {
  console.error("[db] idle client error (handled — pool continues serving new connections):", err);
});

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
