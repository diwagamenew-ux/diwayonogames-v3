import { db } from "@/db";
import { games, posts, categories, tags, pages } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { slugify } from "./util";

const TABLES = { games, posts, categories, tags, pages } as const;

export async function uniqueSlug(
  table: keyof typeof TABLES,
  baseRaw: string,
  excludeId?: number
): Promise<string> {
  const t = TABLES[table] as typeof games;
  const base = slugify(baseRaw) || "item";
  let candidate = base;
  for (let i = 0; i < 30; i++) {
    const cond = excludeId
      ? and(eq(t.slug, candidate), ne(t.id, excludeId))
      : eq(t.slug, candidate);
    const rows = await db.select({ id: t.id }).from(t).where(cond).limit(1);
    if (rows.length === 0) return candidate;
    candidate = `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
  }
  return candidate + "-" + Date.now();
}
