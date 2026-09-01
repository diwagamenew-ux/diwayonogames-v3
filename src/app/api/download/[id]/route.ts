import { NextResponse } from "next/server";
import { db } from "@/db";
import { downloadLinks, games } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { configuredSiteUrl, rateLimit, getClientIp } from "@/lib/util";
import { getSettings } from "@/lib/settings";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const base = configuredSiteUrl(await getSettings());
  const linkId = parseInt(id, 10);
  if (!Number.isFinite(linkId)) {
    return NextResponse.redirect(base, 302);
  }
  const [link] = await db
    .select()
    .from(downloadLinks)
    .where(eq(downloadLinks.id, linkId))
    .limit(1);
  if (!link) return NextResponse.redirect(base, 302);

  if (rateLimit("dl:" + getClientIp(req), 30, 60_000)) {
    await db
      .update(downloadLinks)
      .set({ hits: sql`${downloadLinks.hits} + 1` })
      .where(eq(downloadLinks.id, link.id));
    await db
      .update(games)
      .set({ downloads: sql`${games.downloads} + 1` })
      .where(eq(games.id, link.gameId));
  }

  const target = link.url.startsWith("/") ? base + link.url : link.url;
  return NextResponse.redirect(target, 302);
}
