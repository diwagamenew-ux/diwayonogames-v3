import type { MetadataRoute } from "next";
import { configuredSiteUrl, siteUrl } from "@/lib/util";
import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";

export default async function robots(): Promise<MetadataRoute.Robots> {
  let base = siteUrl();
  try {
    const s = await getSettings();
    base = configuredSiteUrl(s);
  } catch (error) {
    console.error("[robots] settings unavailable; using deployment URL:", error);
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/search"],
      },
    ],
    sitemap: base + "/sitemap.xml",
  };
}
