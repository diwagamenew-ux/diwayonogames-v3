import { getSettings, saveSettings, type SiteSettings } from "@/lib/settings";
import { json, requirePerm, checkOrigin } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { isReasonableScriptField } from "@/lib/analytics";

export async function GET() {
  const auth = await requirePerm("*");
  if (auth instanceof Response) return auth;
  return json({ settings: await getSettings() });
}

export async function PUT(req: Request) {
  const auth = await requirePerm("*");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const body = (await req.json().catch(() => null)) as { settings?: SiteSettings } | null;
  if (!body?.settings) return json({ error: "Invalid payload" }, 400);

  // Guard against pathological payloads in the raw-script SEO fields
  // (Analytics / GTM / Clarity). We can't "sanitize" third-party tracking
  // JS and have it still work, but a size cap is a cheap, practical check
  // that catches accidental paste errors / abuse without touching
  // legitimate snippets, which are always well under this limit.
  if (body.settings.siteUrl) {
    try {
      const u = new URL(body.settings.siteUrl);
      if (!["http:", "https:"].includes(u.protocol)) throw new Error("bad protocol");
      body.settings.siteUrl = u.toString().replace(/\/$/, "");
    } catch {
      return json({ error: "Site URL must be a valid http(s) URL" }, 400);
    }
  }

  const hp = body.settings.homepage;
  if (!hp || typeof hp.h1 !== "string" || typeof hp.heroBadge !== "string" || typeof hp.intro !== "string") {
    return json({ error: "Invalid homepage settings" }, 400);
  }
  if (!Array.isArray(hp.heroLogos) || hp.heroLogos.length !== 3 || hp.heroLogos.some((item) =>
    !item || typeof item.title !== "string" || typeof item.image !== "string" || typeof item.url !== "string" ||
    item.title.length > 120 || item.image.length > 250_000 || item.url.length > 2_000
  )) {
    return json({ error: "Homepage Hero Logos must contain exactly 3 valid logo slots" }, 400);
  }

  const scriptFields: [string, string][] = [
    ["Google Analytics code", body.settings.seo?.analyticsCode ?? ""],
    ["Google Tag Manager code", body.settings.seo?.gtmCode ?? ""],
    ["Microsoft Clarity code", body.settings.seo?.clarityCode ?? ""],
  ];
  for (const [label, value] of scriptFields) {
    if (!isReasonableScriptField(value)) {
      return json({ error: `${label} is too long (max 20,000 characters)` }, 400);
    }
  }

  await saveSettings(body.settings);
  revalidatePath("/");
  revalidatePath("/sitemap.xml");
  revalidatePath("/robots.txt");
  revalidatePath("/games", "page");
  revalidatePath("/blog", "page");
  revalidatePath("/game/[slug]", "page");
  revalidatePath("/blog/[slug]", "page");
  revalidatePath("/category/[slug]", "page");
  revalidatePath("/tag/[slug]", "page");
  revalidatePath("/page/[slug]", "page");
  await logAudit({ action: "update", entity: "settings", summary: `${body.settings.siteName || ""} settings updated`, req, session: auth });
  return json({ ok: true });
}
