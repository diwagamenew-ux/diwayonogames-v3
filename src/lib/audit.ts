import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { getSession, type SessionUser } from "./auth";
import { getClientIp } from "./util";

export type AuditAction = "create" | "update" | "delete" | "login" | "logout" | "publish" | "reject" | "approve";
export type AuditEntity =
  | "game" | "post" | "category" | "tag" | "page" | "user" | "settings"
  | "review" | "redirect" | "download_link" | "inbox" | "backup";

/**
 * Records an admin action for the Audit Log (Admin → Audit Log). Never
 * throws — logging must not be able to break the mutation it's recording.
 * Pass `session` explicitly when already available to avoid a duplicate
 * cookie lookup; otherwise it's fetched here.
 */
export async function logAudit(opts: {
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string | number;
  summary?: string;
  req?: Request;
  session?: SessionUser | null;
}): Promise<void> {
  try {
    const session = opts.session !== undefined ? opts.session : await getSession();
    await db.insert(auditLogs).values({
      userId: session?.id ?? null,
      userName: session?.name || session?.email || "system",
      action: opts.action,
      entity: opts.entity,
      entityId: opts.entityId !== undefined ? String(opts.entityId) : "",
      summary: (opts.summary || "").slice(0, 500),
      ip: opts.req ? getClientIp(opts.req) : "",
    });
  } catch (err) {
    console.error("[audit] failed to record entry:", err);
  }
}
