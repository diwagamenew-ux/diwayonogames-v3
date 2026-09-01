import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { desc } from "drizzle-orm";
import { json, requirePerm } from "@/lib/api";

export async function GET() {
  const auth = await requirePerm("*");
  if (auth instanceof Response) return auth;
  const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(300);
  return json({ logs: rows });
}
