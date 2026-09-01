import { db } from "@/db";
import { gameRequests, reports, contactMessages, newsletterSubs } from "@/db/schema";
import { json, checkOrigin, asStr } from "@/lib/api";
import { rateLimit, getClientIp, verifyCaptcha } from "@/lib/util";
import { formSchema, isHoneypotTripped } from "@/lib/validation";

/* GET: issue a simple math captcha challenge */
export async function GET() {
  const a = 2 + Math.floor(Math.random() * 8);
  const b = 1 + Math.floor(Math.random() * 8);
  return json({ token: `${a}:${b}`, question: `What is ${a} + ${b}?` });
}

export async function POST(req: Request) {
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const ip = getClientIp(req);
  const rawBody = await req.json().catch(() => ({}));

  // Honeypot: a hidden "website" field no real visitor can see or fill.
  // Bots that blindly fill every input trip it. We return a fake success
  // so the bot doesn't learn to avoid the field, but never touch the DB.
  if (isHoneypotTripped(rawBody?.website)) {
    return json({ ok: true, message: "Thanks!" });
  }

  const kind = asStr(rawBody.kind, 20);

  if (kind === "newsletter") {
    if (!rateLimit("nl:" + ip, 5, 60_000)) return json({ error: "Too many requests" }, 429);
    const parsed = formSchema.safeParse(rawBody);
    if (!parsed.success || parsed.data.kind !== "newsletter") {
      return json({ error: "Invalid email" }, 400);
    }
    await db.insert(newsletterSubs).values({ email: parsed.data.email.toLowerCase() }).onConflictDoNothing();
    return json({ ok: true, message: "Subscribed successfully!" });
  }

  if (!rateLimit("form:" + ip, 6, 60_000)) return json({ error: "Too many requests" }, 429);
  if (!verifyCaptcha(asStr(rawBody.captchaToken), asStr(rawBody.captchaAnswer))) {
    return json({ error: "Incorrect captcha answer" }, 400);
  }

  const parsed = formSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return json({ error: firstIssue ? `${firstIssue.path.join(".")}: ${firstIssue.message}` : "Invalid submission" }, 400);
  }
  const data = parsed.data;

  if (data.kind === "request") {
    await db.insert(gameRequests).values({
      name: data.name, gameName: data.gameName, email: data.email || "", message: data.message || "",
    });
    return json({ ok: true, message: "Request submitted! We will review it soon." });
  }

  if (data.kind === "report") {
    await db.insert(reports).values({
      gameId: data.gameId ? parseInt(String(data.gameId), 10) : null,
      url: data.url || "",
      reason: data.reason || "Broken link",
      message: data.message || "",
    });
    return json({ ok: true, message: "Report submitted. Thank you!" });
  }

  if (data.kind === "contact") {
    await db.insert(contactMessages).values({
      name: data.name, email: data.email, message: data.message, subject: data.subject || "",
    });
    return json({ ok: true, message: "Message sent! We'll get back to you soon." });
  }

  if (data.kind === "review") {
    const rating = Math.min(5, Math.max(1, parseInt(String(data.rating ?? 5), 10) || 5));
    const gameId = data.gameId ? parseInt(String(data.gameId), 10) : null;
    const postId = data.postId ? parseInt(String(data.postId), 10) : null;
    if (!gameId && !postId) return json({ error: "Missing target for review" }, 400);
    const { reviews } = await import("@/db/schema");
    await db.insert(reviews).values({ name: data.name, rating, comment: data.comment, gameId, postId, status: "pending" });
    return json({ ok: true, message: "Review submitted! It will appear after moderation." });
  }

  return json({ error: "Unknown form kind" }, 400);
}
