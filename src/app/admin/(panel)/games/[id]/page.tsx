import { notFound } from "next/navigation";
import { db } from "@/db";
import { games, categories, tags, gameTags, downloadLinks } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { GameForm } from "@/components/admin/game-form";

export const dynamic = "force-dynamic";

export default async function EditGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gameId = parseInt(id, 10);
  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game) notFound();
  const [cats, allTags, tagRows, links] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.name)),
    db.select().from(tags).orderBy(asc(tags.name)).limit(300),
    db.select().from(gameTags).where(eq(gameTags.gameId, gameId)),
    db.select().from(downloadLinks).where(eq(downloadLinks.gameId, gameId)).orderBy(downloadLinks.sort),
  ]);

  return (
    <div>
      <h1 className="font-display text-4xl gold-text tracking-wide mb-6">EDIT GAME</h1>
      <GameForm
        initial={{
          id: game.id,
          title: game.title, slug: game.slug, shortDesc: game.shortDesc, content: game.content,
          icon: game.icon, banner: game.banner, version: game.version, size: game.size,
          developer: game.developer, packageName: game.packageName, minAndroid: game.minAndroid,
          bonus: game.bonus, categoryId: game.categoryId, featured: game.featured, status: game.status,
          metaTitle: game.metaTitle, metaDescription: game.metaDescription, h1: game.h1,
          focusKeyword: game.focusKeyword, secondaryKeywords: game.secondaryKeywords, canonicalUrl: game.canonicalUrl, ogTitle: game.ogTitle, ogDescription: game.ogDescription, ogImage: game.ogImage, twitterTitle: game.twitterTitle, twitterDescription: game.twitterDescription, twitterImage: game.twitterImage, noIndex: game.noIndex, noFollow: game.noFollow,
          faqs: game.faqs, tagIds: tagRows.map((t) => t.tagId),
          editorialRating: game.editorialRating,
          links: links.length
            ? links.map((l) => ({ label: l.label, url: l.url, version: l.version, size: l.size }))
            : [{ label: "Download APK", url: "", version: game.version, size: game.size }],
        }}
        categories={cats}
        allTags={allTags}
      />
    </div>
  );
}
