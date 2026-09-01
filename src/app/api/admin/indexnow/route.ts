import { json, requirePerm, checkOrigin } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { configuredSiteUrl } from "@/lib/util";

export async function POST(req: Request) {
  const auth = await requirePerm("*");
  if (auth instanceof Response) return auth;
  if (!checkOrigin(req)) return json({ error: "Bad origin" }, 403);
  const s = await getSettings();
  const key = s.seo.indexNowKey;
  const base = configuredSiteUrl(s);
  if (!key) return json({ error: "Set your IndexNow key in Settings → SEO first." }, 400);
  const body = await req.json().catch(() => ({}));
  const urls: string[] = Array.isArray(body.urls) ? body.urls.slice(0, 100) : [base + "/sitemap.xml"];
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      host: new URL(base).host,
      key,
      keyLocation: `${base}/${key}.txt`,
      urlList: urls,
    }),
  }).catch(() => null);
  if (!res) return json({ error: "Failed to reach IndexNow" }, 502);
  return json({ ok: res.ok || res.status === 202, status: res.status });
}
