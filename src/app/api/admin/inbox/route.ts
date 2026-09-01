import { db } from "@/db";
import { gameRequests, reports, contactMessages, newsletterSubs, games } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { json, requirePerm, checkOrigin, asStr, asInt } from "@/lib/api";

const KINDS = {
  request: gameRequests,
  report: reports,
  contact: contactMessages,
  subscriber: newsletterSubs,
} as const;

export async function GET() {
  const auth = await requirePerm("inbox");
  if (auth instanceof Response) return auth;
  const [reqs, reps, msgs, subs] = await Promise.all([
    db.select().from(gameRequests).orderBy(desc(gameRequests.createdAt)).limit(200),
    db
      .select({ report: reports, gameTitle: games.title })
      .from(reports)
      .leftJoin(games, eq(reports.gameId, games.id))
      .orderBy(desc(reports.createdAt))
      .limit(200),
    db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(200),
    db.select().from(newsletterSubs).orderBy(desc(newsletterSubs.createdAt)).limit(500),
  ]);
  return json({
    requests: reqs,
    reports: reps.map((r) => ({ ...r.report, gameTitle: r.gameTitle })),
    contacts: msgs,
    subscribers: subs,
  });
}

export async function PUT(req: Request) {
  const auth = await requirePerm("inbox");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const body = await req.json().catch(() => ({}));
  const kind = asStr(body.kind, 20) as keyof typeof KINDS;
  const id = asInt(body.id);
  const status = asStr(body.status, 20) || "done";
  const table = KINDS[kind];
  if (!table || !id || kind === "subscriber") return json({ error: "Invalid data" }, 400);
  await db
    .update(table)
    .set({ status } as never)
    .where(eq((table as typeof gameRequests).id, id));
  return json({ ok: true });
}

export async function DELETE(req: Request) {
  const auth = await requirePerm("inbox");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const url = new URL(req.url);
  const kind = asStr(url.searchParams.get("kind"), 20) as keyof typeof KINDS;
  const id = asInt(url.searchParams.get("id"));
  const table = KINDS[kind];
  if (!table || !id) return json({ error: "Invalid data" }, 400);
  await db.delete(table).where(eq((table as typeof gameRequests).id, id));
  return json({ ok: true });
}
