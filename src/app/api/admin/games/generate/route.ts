import { db } from "@/db";
import { games, categories } from "@/db/schema";
import { eq, ilike } from "drizzle-orm";
import { json, requirePerm, checkOrigin, asStr, asInt } from "@/lib/api";
import { uniqueSlug } from "@/lib/slug";
import { cleanText } from "@/lib/sanitize";
import { generateGameDetails } from "@/lib/game-generator";

/**
 * POST /api/admin/games/generate
 * Body: { name: string, categoryId?: number }
 *
 * Returns a full set of auto-generated Add-Game fields for the admin to
 * review/edit before saving. Nothing is written to the database here —
 * this only proposes content; POST /api/admin/games (or PUT .../[id]) is
 * still what actually creates/updates the record.
 */
export async function POST(req: Request) {
  const auth = await requirePerm("games");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);

  const body = await req.json().catch(() => ({}));
  const name = cleanText(asStr(body.name, 200));
  if (!name) return json({ error: "Game name is required" }, 400);

  const categoryId = asInt(body.categoryId) || null;
  let categoryName = "";
  if (categoryId) {
    const [cat] = await db.select({ name: categories.name }).from(categories).where(eq(categories.id, categoryId)).limit(1);
    categoryName = cat?.name || "";
  }

  // Duplicate protection (rule 21): warn the admin if a game with a very
  // similar name already exists, without blocking — they may still want a
  // second, differently-slugged entry (e.g. a v2 listing).
  const existing = await db
    .select({ id: games.id, title: games.title, slug: games.slug })
    .from(games)
    .where(ilike(games.title, name))
    .limit(1);

  const generated = generateGameDetails({ name, categoryName });
  const slug = await uniqueSlug("games", generated.slugBase);

  return json({
    ok: true,
    duplicate: existing[0] ? { id: existing[0].id, title: existing[0].title, slug: existing[0].slug } : null,
    fields: {
      title: generated.title,
      slug,
      shortDesc: generated.shortDesc,
      content: generated.content,
      version: generated.version,
      size: generated.size,
      minAndroid: generated.minAndroid,
      developer: generated.developer,
      packageName: generated.packageName,
      bonus: generated.bonus,
      metaTitle: generated.metaTitle,
      metaDescription: generated.metaDescription,
      focusKeyword: generated.focusKeyword,
      canonicalUrl: generated.canonicalUrl,
      faqs: generated.faqs,
      tagNames: generated.tagNames,
      editorialRating: generated.editorialRating,
    },
  });
}
