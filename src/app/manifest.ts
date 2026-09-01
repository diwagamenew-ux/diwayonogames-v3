import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings();
  return {
    name: s.siteName,
    short_name: s.siteName,
    description: s.description,
    start_url: "/",
    display: "standalone",
    background_color: "#f4f2fb",
    theme_color: "#8b5cf6",
    icons: [
      { src: s.faviconUrl || s.logoUrl, sizes: "192x192", type: "image/png" },
      { src: s.faviconUrl || s.logoUrl, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
