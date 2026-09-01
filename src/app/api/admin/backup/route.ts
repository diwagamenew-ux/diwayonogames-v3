import { db } from "@/db";
import * as schema from "@/db/schema";
import { json, requirePerm, checkOrigin } from "@/lib/api";
import { sql } from "drizzle-orm";

const TABLES = [
  "users", "categories", "games", "downloadLinks", "tags", "gameTags",
  "posts", "postTags", "reviews", "pages", "settings", "redirects",
  "notFoundLogs", "newsletterSubs", "gameRequests", "reports", "contactMessages",
] as const;

const DB_TABLE_NAMES: Record<(typeof TABLES)[number], string> = {
  users: "users", categories: "categories", games: "games", downloadLinks: "download_links",
  tags: "tags", gameTags: "game_tags", posts: "posts", postTags: "post_tags",
  reviews: "reviews", pages: "pages", settings: "settings", redirects: "redirects",
  notFoundLogs: "not_found_logs", newsletterSubs: "newsletter_subs",
  gameRequests: "game_requests", reports: "reports", contactMessages: "contact_messages",
};

export async function GET() {
  const auth = await requirePerm("*");
  if (auth instanceof Response) return auth;
  const dump: Record<string, unknown[]> = {};
  for (const key of TABLES) {
    const table = (schema as unknown as Record<string, never>)[key];
    dump[key] = await db.select().from(table as never);
  }
  return new Response(
    JSON.stringify({ app: "YonoDiwaGames", version: 1, exportedAt: new Date().toISOString(), data: dump }),
    {
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="yonodiwagames-backup-${Date.now()}.json"`,
      },
    }
  );
}

export async function POST(req: Request) {
  const auth = await requirePerm("*");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const body = await req.json().catch(() => null);
  const data = (body as { data?: Record<string, unknown[]> })?.data;
  if (!data || typeof data !== "object") return json({ error: "Invalid backup file" }, 400);

  // Sanity check the upload before doing anything destructive: a malformed
  // or empty file (e.g. `{"data": {}}`) must not be able to truncate every
  // table and leave the site empty. Require at least the users table to be
  // a non-empty array, since every real backup produced by GET above has one.
  if (!Array.isArray(data.users) || data.users.length === 0) {
    return json({ error: "Backup file looks empty or invalid — refusing to restore (this would wipe existing data)" }, 400);
  }

  // Clear in dependency-safe order then re-insert
  for (const key of [...TABLES].reverse()) {
    await db.execute(sql.raw(`TRUNCATE TABLE ${DB_TABLE_NAMES[key]} CASCADE`));
  }
  for (const key of TABLES) {
    const rows = data[key];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    const table = (schema as unknown as Record<string, never>)[key];
    // insert in chunks
    const chunkSize = 100;
    for (let i = 0; i < rows.length; i += chunkSize) {
      await db.insert(table as never).values(rows.slice(i, i + chunkSize) as never[]);
    }
    // reset serial sequences
    const name = DB_TABLE_NAMES[key];
    await db.execute(
      sql.raw(
        `SELECT setval(pg_get_serial_sequence('${name}','id'), COALESCE((SELECT MAX(id) FROM ${name}), 1)) WHERE pg_get_serial_sequence('${name}','id') IS NOT NULL`
      )
    );
  }
  return json({ ok: true });
}
