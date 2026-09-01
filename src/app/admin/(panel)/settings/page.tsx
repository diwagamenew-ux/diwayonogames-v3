"use client";

import { useEffect, useState } from "react";
import type { SiteSettings } from "@/lib/settings";
import { ImageField } from "@/components/admin/image-field";

const TABS = ["General", "Homepage", "Links Manager", "Social Links", "SEO & Verification", "Ads Manager", "Advanced"] as const;

const AD_SLOTS: { key: keyof SiteSettings["ads"]; label: string; hint: string }[] = [
  { key: "header", label: "Below Header / After Hero", hint: "Banner ad shown at the top of the homepage" },
  { key: "sidebar", label: "Sidebar", hint: "Game detail page sidebar" },
  { key: "inContent", label: "In-Content", hint: "Inside articles and game descriptions" },
  { key: "beforeDownload", label: "Before Download Button", hint: "Right above the main download CTA" },
  { key: "stickyBottom", label: "Sticky Bottom (Mobile)", hint: "Reserved slot — use for anchor ads code" },
  { key: "popup", label: "Popup (once per session)", hint: "Shows 6s after page load, once per visitor" },
];

/* Hoisted, stable components (prevents input focus loss while typing) */
function Field({ label, value, onChange, hint, mono, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; mono?: boolean; type?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type={type} className={`input ${mono ? "font-mono text-sm" : ""}`} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-[0.68rem] text-mute mt-1">{hint}</p>}
    </div>
  );
}

function CodeField({ label, value, onChange, hint, rows = 4 }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; rows?: number;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <textarea className="input font-mono text-xs" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-[0.68rem] text-mute mt-1">{hint}</p>}
    </div>
  );
}

function LinksEditor({ title, description, items, onChange }: {
  title: string; description: string;
  items: { label: string; url: string }[];
  onChange: (items: { label: string; url: string }[]) => void;
}) {
  return (
    <div className="card p-5">
      <h2 className="section-title text-lg">{title}</h2>
      <p className="text-[0.68rem] text-mute mt-1 mb-4">{description}</p>
      <div className="space-y-2.5">
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] gap-2 items-center">
            <input
              className="input !py-2 text-sm"
              value={item.label}
              placeholder="Label"
              aria-label="Link label"
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
            />
            <input
              className="input !py-2 text-sm font-mono"
              value={item.url}
              placeholder="/games or https://…"
              aria-label="Link URL"
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
            />
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-rose-400 hover:text-rose-300 text-sm px-2" title="Remove">✕</button>
          </div>
        ))}
      </div>
      <button
        onClick={() => onChange([...items, { label: "", url: "/" }])}
        className="btn-ghost px-4 py-2 text-xs mt-4"
      >
        + Add link
      </button>
    </div>
  );
}

export default function AdminSettingsPage() {
  const [s, setS] = useState<SiteSettings | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("General");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [indexNowMsg, setIndexNowMsg] = useState("");

  const load = () => fetch("/api/admin/settings").then((r) => r.json()).then((d) => setS(d.settings)).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!s) return <p className="text-mute">Loading settings…</p>;

  const set = (fn: (p: SiteSettings) => SiteSettings) => setS((p) => (p ? fn(p) : p));

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settings: s }),
    }).catch(() => null);
    setBusy(false);
    if (!res) {
      setMsg({ ok: false, text: "Network error — check your connection and try again." });
    } else if (res.ok) {
      setMsg({ ok: true, text: "Settings saved! Changes are live instantly." });
    } else {
      // Surface the real server error so the admin knows *why* the save
      // failed instead of just seeing a generic "Save failed".
      const data = await res.json().catch(() => ({}));
      const detail = data?.error || `HTTP ${res.status}`;
      setMsg({ ok: false, text: `Save failed: ${detail}` });
    }
    setTimeout(() => setMsg(null), 6000);
  };

  const pingIndexNow = async () => {
    setIndexNowMsg("Pinging…");
    const res = await fetch("/api/admin/indexnow", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setIndexNowMsg(res?.ok ? `✔ Submitted (status ${data.status})` : `✖ ${data?.error || "Failed"}`);
  };

  const importBackup = async (file: File) => {
    if (!confirm("Importing a backup will REPLACE all current data. Continue?")) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed),
      });
      setMsg(res.ok ? { ok: true, text: "Backup imported successfully!" } : { ok: false, text: "Import failed — invalid backup file" });
      load();
    } catch {
      setMsg({ ok: false, text: "Invalid JSON file" });
    }
  };

  const setSocial = (k: keyof SiteSettings["social"]) => (v: string) =>
    set((p) => ({ ...p, social: { ...p.social, [k]: v } }));

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-4xl gold-text tracking-wide">SITE SETTINGS</h1>
          <p className="text-sm text-mute mt-1">Change site name, links, ads and everything else — no coding required.</p>
        </div>
        <button onClick={save} disabled={busy} className="btn-gold px-6 py-2.5 text-sm disabled:opacity-50">
          {busy ? "Saving…" : "💾 Save All"}
        </button>
      </div>

      {msg && (
        <p className={`mb-5 text-sm rounded-xl px-4 py-3 ${msg.ok ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/10 text-rose-400 border border-rose-500/30"}`}>
          {msg.text}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`chip px-4 py-2 text-xs font-semibold ${tab === t ? "!border-accent !text-gold2" : "text-mute"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "General" && (
        <div className="card p-5 sm:p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Site name" value={s.siteName} onChange={(v) => set((p) => ({ ...p, siteName: v }))} hint="Shown in header, footer & page titles" />
            <Field label="Site URL / Canonical Domain" value={s.siteUrl} onChange={(v) => set((p) => ({ ...p, siteUrl: v }))} hint="Used for canonical URLs, sitemap, robots.txt and structured data. Domain/DNS is still configured in Vercel." mono />
            <Field label="Tagline" value={s.tagline} onChange={(v) => set((p) => ({ ...p, tagline: v }))} />
          </div>
          <Field label="Site description (default meta)" value={s.description} onChange={(v) => set((p) => ({ ...p, description: v }))} />
          <Field label="Default keywords (comma separated)" value={s.keywords} onChange={(v) => set((p) => ({ ...p, keywords: v }))} />
          <div className="grid sm:grid-cols-2 gap-4">
            <ImageField
              label="Logo"
              value={s.logoUrl}
              onChange={(v) => set((p) => ({ ...p, logoUrl: v }))}
              profile="logo"
              shape="square"
              hint="512×512 recommended — shown in header, footer & app icons"
            />
            <ImageField
              label="Favicon"
              value={s.faviconUrl}
              onChange={(v) => set((p) => ({ ...p, faviconUrl: v }))}
              profile="favicon"
              shape="square"
              hint="Saved as PNG for maximum browser tab compatibility"
            />
          </div>
          <div className="card p-4 border border-accent/20 bg-panel2/40">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="font-semibold">Homepage Hero Logos</h3>
                <p className="text-xs text-mute mt-1">Control the 3 floating logos shown in the homepage hero. Upload an image, set its title and choose the page it opens.</p>
              </div>
              <span className="chip px-2 py-1 text-[0.65rem] text-accent">3 slots</span>
            </div>
            <div className="grid lg:grid-cols-3 gap-4">
              {(s.homepage.heroLogos || []).slice(0, 3).map((item, i) => (
                <div key={i} className="card p-3 space-y-3">
                  <p className="text-xs font-bold text-accent uppercase tracking-wider">Logo {i + 1}</p>
                  <ImageField
                    label="Logo image"
                    value={item.image}
                    onChange={(v) => set((p) => { const a = [...(p.homepage.heroLogos || [])]; a[i] = { ...a[i], image: v }; return { ...p, homepage: { ...p.homepage, heroLogos: a } }; })}
                    profile="icon"
                    shape="square"
                    hint="512×512 recommended"
                  />
                  <Field label="Title" value={item.title} onChange={(v) => set((p) => { const a = [...(p.homepage.heroLogos || [])]; a[i] = { ...a[i], title: v }; return { ...p, homepage: { ...p.homepage, heroLogos: a } }; })} />
                  <Field label="Link" value={item.url} onChange={(v) => set((p) => { const a = [...(p.homepage.heroLogos || [])]; a[i] = { ...a[i], url: v }; return { ...p, homepage: { ...p.homepage, heroLogos: a } }; })} hint="Example: /game/diwa-win-apk" />
                </div>
              ))}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Primary color (violet)</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={s.theme.primary} onChange={(e) => set((p) => ({ ...p, theme: { ...p.theme, primary: e.target.value } }))} className="w-11 h-11 rounded-lg bg-transparent border border-line cursor-pointer" />
                <input className="input font-mono text-sm" value={s.theme.primary} onChange={(e) => set((p) => ({ ...p, theme: { ...p.theme, primary: e.target.value } }))} />
              </div>
            </div>
            <div>
              <label className="label">Accent color (gold)</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={s.theme.accent} onChange={(e) => set((p) => ({ ...p, theme: { ...p.theme, accent: e.target.value } }))} className="w-11 h-11 rounded-lg bg-transparent border border-line cursor-pointer" />
                <input className="input font-mono text-sm" value={s.theme.accent} onChange={(e) => set((p) => ({ ...p, theme: { ...p.theme, accent: e.target.value } }))} />
              </div>
            </div>
          </div>
          <Field label="Footer text" value={s.footerText} onChange={(v) => set((p) => ({ ...p, footerText: v }))} />
          <Field label="Copyright line" value={s.copyright} onChange={(v) => set((p) => ({ ...p, copyright: v }))} />
        </div>
      )}

      {tab === "Homepage" && (
        <div className="space-y-4">
          <div className="card p-5 sm:p-6 space-y-4">
            <h2 className="section-title text-lg">Hero Content</h2>
            <p className="text-xs text-mute">All homepage hero copy is editable. Leave the badge empty to hide it completely.</p>
            <Field label="Hero badge / eyebrow text" value={s.homepage.heroBadge} onChange={(v) => set((p) => ({ ...p, homepage: { ...p.homepage, heroBadge: v } }))} hint="Example: Latest Android Games & Apps" />
            <Field label="Homepage H1" value={s.seo.homepage.h1 || s.homepage.h1} onChange={(v) => set((p) => ({ ...p, homepage: { ...p.homepage, h1: v }, seo: { ...p.seo, homepage: { ...p.seo.homepage, h1: v } } }))} />
            <label className="label">Homepage introduction</label>
            <textarea className="input" rows={4} value={s.homepage.intro} onChange={(e) => set((p) => ({ ...p, homepage: { ...p.homepage, intro: e.target.value } }))} />
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Primary CTA text" value={s.homepage.primaryCtaText} onChange={(v) => set((p) => ({ ...p, homepage: { ...p.homepage, primaryCtaText: v } }))} />
              <Field label="Primary CTA URL" value={s.homepage.primaryCtaUrl} onChange={(v) => set((p) => ({ ...p, homepage: { ...p.homepage, primaryCtaUrl: v } }))} mono />
            </div>
          </div>
          <div className="card p-5 sm:p-6 space-y-4">
            <h2 className="section-title text-lg">Homepage Sections</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Featured / Top Rated title" value={s.homepage.featuredTitle} onChange={(v) => set((p) => ({ ...p, homepage: { ...p.homepage, featuredTitle: v } }))} />
              <Field label="Latest games title" value={s.homepage.latestTitle} onChange={(v) => set((p) => ({ ...p, homepage: { ...p.homepage, latestTitle: v } }))} />
              <Field label="Trending title" value={s.homepage.trendingTitle} onChange={(v) => set((p) => ({ ...p, homepage: { ...p.homepage, trendingTitle: v } }))} />
              <Field label="Categories title" value={s.homepage.categoriesTitle} onChange={(v) => set((p) => ({ ...p, homepage: { ...p.homepage, categoriesTitle: v } }))} />
              <Field label="Blog title" value={s.homepage.blogTitle} onChange={(v) => set((p) => ({ ...p, homepage: { ...p.homepage, blogTitle: v } }))} />
              <Field label="CTA title" value={s.homepage.ctaTitle} onChange={(v) => set((p) => ({ ...p, homepage: { ...p.homepage, ctaTitle: v } }))} />
            </div>
            <label className="label">CTA description</label>
            <textarea className="input" rows={3} value={s.homepage.ctaDescription} onChange={(e) => set((p) => ({ ...p, homepage: { ...p.homepage, ctaDescription: e.target.value } }))} />
          </div>
        </div>
      )}

      {tab === "Links Manager" && (
        <div className="space-y-4">
          <p className="text-xs text-mute">
            Control exactly which links appear in the site header menu and footer. Add your own pages,
            external URLs (Telegram, download portals…) — anything. Saved instantly, no coding needed.
          </p>
          <LinksEditor
            title="Header Menu Links"
            description="Shown in the top navigation bar on desktop & mobile"
            items={s.nav.headerLinks}
            onChange={(items) => set((p) => ({ ...p, nav: { ...p.nav, headerLinks: items } }))}
          />
          <LinksEditor
            title="Footer Links"
            description="Shown in the legal / quick-links row at the bottom of every page"
            items={s.nav.footerLinks}
            onChange={(items) => set((p) => ({ ...p, nav: { ...p.nav, footerLinks: items } }))}
          />
        </div>
      )}

      {tab === "Social Links" && (
        <div className="card p-5 sm:p-6 space-y-4">
          <p className="text-xs text-mute">Leave empty to hide. Changes apply to header, footer & floating buttons instantly.</p>
          <Field label="✈ Telegram link" value={s.social.telegram} onChange={setSocial("telegram")} />
          <Field label="💬 WhatsApp link" value={s.social.whatsapp} onChange={setSocial("whatsapp")} />
          <Field label="🎮 Discord invite" value={s.social.discord} onChange={setSocial("discord")} />
          <Field label="📘 Facebook page" value={s.social.facebook} onChange={setSocial("facebook")} />
          <Field label="📸 Instagram" value={s.social.instagram} onChange={setSocial("instagram")} />
          <Field label="𝕏 Twitter (X)" value={s.social.twitter} onChange={setSocial("twitter")} />
          <Field label="▶ YouTube channel" value={s.social.youtube} onChange={setSocial("youtube")} />
          <Field label="✉ Support email" value={s.social.email} onChange={setSocial("email")} type="email" />
          <Field label="🌐 Website URL" value={s.social.website} onChange={setSocial("website")} />
          <div className="grid sm:grid-cols-3 gap-4 pt-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="accent-[#f5b942] w-4 h-4" checked={s.features.telegramFloat} onChange={(e) => set((p) => ({ ...p, features: { ...p.features, telegramFloat: e.target.checked } }))} />
              Floating Telegram button
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="accent-[#f5b942] w-4 h-4" checked={s.features.whatsappFloat} onChange={(e) => set((p) => ({ ...p, features: { ...p.features, whatsappFloat: e.target.checked } }))} />
              Floating WhatsApp button
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="accent-[#f5b942] w-4 h-4" checked={s.features.cookieConsent} onChange={(e) => set((p) => ({ ...p, features: { ...p.features, cookieConsent: e.target.checked } }))} />
              Cookie consent bar
            </label>
          </div>
        </div>
      )}

      {tab === "SEO & Verification" && (
        <div className="space-y-4">
          <div className="card p-5 sm:p-6 space-y-4">
            <h2 className="section-title text-lg">Homepage SEO</h2>
            <p className="text-xs text-mute">Manual homepage values override the site-wide defaults. Empty fields use sensible fallbacks.</p>
            <Field label={`Homepage SEO title (${s.seo.homepage.title.length} chars)`} value={s.seo.homepage.title} onChange={(v) => set((p) => ({ ...p, seo: { ...p.seo, homepage: { ...p.seo.homepage, title: v } } }))} />
            <label className="label">Homepage meta description</label>
            <textarea className="input" rows={3} value={s.seo.homepage.description} onChange={(e) => set((p) => ({ ...p, seo: { ...p.seo, homepage: { ...p.seo.homepage, description: e.target.value } } }))} />
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Focus keyword" value={s.seo.homepage.focusKeyword} onChange={(v) => set((p) => ({ ...p, seo: { ...p.seo, homepage: { ...p.seo.homepage, focusKeyword: v } } }))} />
              <Field label="Secondary keywords" value={s.seo.homepage.secondaryKeywords} onChange={(v) => set((p) => ({ ...p, seo: { ...p.seo, homepage: { ...p.seo.homepage, secondaryKeywords: v } } }))} />
            </div>
            <Field label="Canonical override" value={s.seo.homepage.canonical} onChange={(v) => set((p) => ({ ...p, seo: { ...p.seo, homepage: { ...p.seo.homepage, canonical: v } } }))} mono hint="Leave empty to use Site URL + /" />
            <div className="flex flex-wrap gap-5 text-sm">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={s.seo.homepage.noIndex} onChange={(e) => set((p) => ({ ...p, seo: { ...p.seo, homepage: { ...p.seo.homepage, noIndex: e.target.checked } } }))} /> Noindex homepage</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={s.seo.homepage.noFollow} onChange={(e) => set((p) => ({ ...p, seo: { ...p.seo, homepage: { ...p.seo.homepage, noFollow: e.target.checked } } }))} /> Nofollow links</label>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="OG title" value={s.seo.homepage.ogTitle} onChange={(v) => set((p) => ({ ...p, seo: { ...p.seo, homepage: { ...p.seo.homepage, ogTitle: v } } }))} />
              <Field label="OG image URL" value={s.seo.homepage.ogImage} onChange={(v) => set((p) => ({ ...p, seo: { ...p.seo, homepage: { ...p.seo.homepage, ogImage: v } } }))} />
            </div>
            <label className="label">OG description</label>
            <textarea className="input" rows={2} value={s.seo.homepage.ogDescription} onChange={(e) => set((p) => ({ ...p, seo: { ...p.seo, homepage: { ...p.seo.homepage, ogDescription: e.target.value } } }))} />
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Twitter/X title" value={s.seo.homepage.twitterTitle} onChange={(v) => set((p) => ({ ...p, seo: { ...p.seo, homepage: { ...p.seo.homepage, twitterTitle: v } } }))} />
              <Field label="Twitter/X image URL" value={s.seo.homepage.twitterImage} onChange={(v) => set((p) => ({ ...p, seo: { ...p.seo, homepage: { ...p.seo.homepage, twitterImage: v } } }))} />
            </div>
            <label className="label">Twitter/X description</label>
            <textarea className="input" rows={2} value={s.seo.homepage.twitterDescription} onChange={(e) => set((p) => ({ ...p, seo: { ...p.seo, homepage: { ...p.seo.homepage, twitterDescription: e.target.value } } }))} />
          </div>

          <div className="card p-5 sm:p-6 space-y-5">
          <div className="grid sm:grid-cols-3 gap-4">
            <CodeField label="Google verification (content=…)" rows={1} value={s.seo.googleVerification} onChange={(v) => set((p) => ({ ...p, seo: { ...p.seo, googleVerification: v } }))} />
            <CodeField label="Bing verification (msvalidate.01)" rows={1} value={s.seo.bingVerification} onChange={(v) => set((p) => ({ ...p, seo: { ...p.seo, bingVerification: v } }))} />
            <CodeField label="Yandex verification" rows={1} value={s.seo.yandexVerification} onChange={(v) => set((p) => ({ ...p, seo: { ...p.seo, yandexVerification: v } }))} />
          </div>
          <CodeField label="Google Analytics (Measurement ID or full <script>)" value={s.seo.analyticsCode} onChange={(v) => set((p) => ({ ...p, seo: { ...p.seo, analyticsCode: v } }))} hint="Paste just your GA4 Measurement ID (e.g. G-LWBDM9HJ68) or the full gtag.js snippet — either works, and it's never loaded on /admin pages." />
          <CodeField label="Google Tag Manager code" value={s.seo.gtmCode} onChange={(v) => set((p) => ({ ...p, seo: { ...p.seo, gtmCode: v } }))} hint="GTM script snippet from Tag Manager." />
          <CodeField label="Microsoft Clarity code" value={s.seo.clarityCode} onChange={(v) => set((p) => ({ ...p, seo: { ...p.seo, clarityCode: v } }))} />
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <CodeField label="IndexNow key" rows={1} value={s.seo.indexNowKey} onChange={(v) => set((p) => ({ ...p, seo: { ...p.seo, indexNowKey: v } }))} hint="Any hex string, used both here and as your key file name." />
            <div>
              <button onClick={pingIndexNow} className="btn-violet px-5 py-2.5 text-sm whitespace-nowrap">Ping IndexNow</button>
              {indexNowMsg && <p className="text-xs mt-2 text-mute">{indexNowMsg}</p>}
            </div>
          </div>
          <div className="border-t border-line pt-4 text-xs text-mute space-y-1.5">
            <p>✔ XML Sitemap: <a href="/sitemap.xml" target="_blank" className="text-accent hover:underline">/sitemap.xml</a> (auto-generated, submit to Search Console)</p>
            <p>✔ Robots.txt: <a href="/robots.txt" target="_blank" className="text-accent hover:underline">/robots.txt</a></p>
            <p>✔ RSS Feed: <a href="/rss.xml" target="_blank" className="text-accent hover:underline">/rss.xml</a> (Google Discover ready)</p>
            <p>✔ JSON-LD schemas (Organization, WebSite, SoftwareApp, Article, FAQ, Breadcrumb) are auto-injected on every page.</p>
          </div>
        </div>
        </div>
      )}

      {tab === "Ads Manager" && (
        <div className="space-y-4">
          <p className="text-xs text-mute">Paste your ad code (AdSense, banners, affiliate HTML…) into any slot and toggle it on. Empty slots render nothing.</p>
          {AD_SLOTS.map((slot) => (
            <div key={slot.key} className="card p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="font-semibold text-sm">{slot.label}</p>
                  <p className="text-[0.68rem] text-mute">{slot.hint}</p>
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer shrink-0">
                  <span className={s.ads[slot.key].enabled ? "text-emerald-400 font-bold" : "text-mute"}>
                    {s.ads[slot.key].enabled ? "ON" : "OFF"}
                  </span>
                  <input
                    type="checkbox"
                    className="accent-[#f5b942] w-5 h-5"
                    checked={s.ads[slot.key].enabled}
                    onChange={(e) => set((p) => ({ ...p, ads: { ...p.ads, [slot.key]: { ...p.ads[slot.key], enabled: e.target.checked } } }))}
                  />
                </label>
              </div>
              <textarea
                className="input font-mono text-xs"
                rows={3}
                placeholder="<script …or… <a href><img>"
                value={s.ads[slot.key].code}
                onChange={(e) => set((p) => ({ ...p, ads: { ...p.ads, [slot.key]: { ...p.ads[slot.key], code: e.target.value } } }))}
              />
            </div>
          ))}
        </div>
      )}

      {tab === "Advanced" && (
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <h2 className="section-title text-lg">Maintenance Mode</h2>
            <label className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input type="checkbox" className="accent-[#f5b942] w-5 h-5" checked={s.features.maintenanceMode} onChange={(e) => set((p) => ({ ...p, features: { ...p.features, maintenanceMode: e.target.checked } }))} />
              <span>Enable maintenance mode <span className="text-rose-400 text-xs">(public site shows maintenance page; /admin stays open)</span></span>
            </label>
            <Field label="Maintenance message" value={s.features.maintenanceMessage} onChange={(v) => set((p) => ({ ...p, features: { ...p.features, maintenanceMessage: v } }))} />
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="section-title text-lg">SMTP / Email Settings</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="SMTP host" value={s.smtp.host} onChange={(v) => set((p) => ({ ...p, smtp: { ...p.smtp, host: v } }))} mono />
              <Field label="SMTP port" value={s.smtp.port} onChange={(v) => set((p) => ({ ...p, smtp: { ...p.smtp, port: v } }))} mono />
              <Field label="SMTP user" value={s.smtp.user} onChange={(v) => set((p) => ({ ...p, smtp: { ...p.smtp, user: v } }))} mono />
              <Field label="SMTP password" value={s.smtp.pass} onChange={(v) => set((p) => ({ ...p, smtp: { ...p.smtp, pass: v } }))} mono type="password" />
            </div>
            <Field label="From address" value={s.smtp.from} onChange={(v) => set((p) => ({ ...p, smtp: { ...p.smtp, from: v } }))} mono />
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="section-title text-lg">Backup & Restore</h2>
            <p className="text-xs text-mute">One-click full database export (games, posts, users, settings — everything) as JSON. Keep it safe and re-import anytime.</p>
            <div className="flex flex-wrap gap-3">
              <a href="/api/admin/backup" className="btn-gold px-5 py-2.5 text-sm">⬇ Export Full Backup</a>
              <label className="btn-ghost px-5 py-2.5 text-sm cursor-pointer">
                ⬆ Import Backup
                <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importBackup(f); }} />
              </label>
            </div>
          </div>

          <div className="card p-5 space-y-3">
            <h2 className="section-title text-lg">Deployment Notes</h2>
            <ul className="text-xs text-mute space-y-1.5 list-disc ml-4">
              <li>Database: set <code className="text-accent">DATABASE_URL</code> in your environment / .env file.</li>
              <li>Auth: set <code className="text-accent">AUTH_SECRET</code> to a long random string in production.</li>
              <li>Site URL: set <code className="text-accent">NEXT_PUBLIC_SITE_URL</code> for correct canonicals & sitemap.</li>
              <li>Schema: run <code className="text-accent">npx drizzle-kit push</code> once on a fresh database for automatic migrations.</li>
              <li>Uploads are stored in <code className="text-accent">public/uploads</code> — back up that folder too.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
