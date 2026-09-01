import { listCategories } from "@/lib/data";
import { db } from "@/db";
import { tags } from "@/db/schema";
import { asc } from "drizzle-orm";
import { GameForm } from "@/components/admin/game-form";

export const dynamic = "force-dynamic";

export default async function NewGamePage() {
  const [cats, allTags] = await Promise.all([
    listCategories(),
    db.select().from(tags).orderBy(asc(tags.name)).limit(300),
  ]);
  return (
    <div>
      <h1 className="font-display text-4xl gold-text tracking-wide mb-6">ADD NEW GAME</h1>
      <GameForm categories={cats} allTags={allTags} />
    </div>
  );
}
