"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { slugify } from "@/lib/util";
import { IconDownload } from "@/components/icons";
import { ImageField } from "@/components/admin/image-field";
import { HtmlEditor } from "@/components/admin/html-editor";

type LinkRow = { label: string; url: string; version: string; size: string };

export type GameFormInitial = {
  id?: number;
  title: string; slug: string; shortDesc: string; content: string;
  icon: string; banner: string; version: string; size: string;
  developer: string; packageName: string; minAndroid: string; bonus: string;
  categoryId: number | null; featured: boolean; status: string;
  metaTitle: string; metaDescription: string; h1: string; focusKeyword: string; secondaryKeywords: string; canonicalUrl: string; ogTitle: string; ogDescription: string; ogImage: string; twitterTitle: string; twitterDescription: string; twitterImage: string; noIndex: boolean; noFollow: boolean;
  faqs: { q: string; a: string }[]; tagIds: number[]; links: LinkRow[];
  editorialRating: number;
};

const EMPTY: GameFormInitial = {
  title: "", slug: "", shortDesc: "", content: "", icon: "", banner: "",
  version: "1.0", size: "", developer: "", packageName: "", minAndroid: "5.0+", bonus: "",
  categoryId: null, featured: false, status: "published",
  metaTitle: "", metaDescription: "", h1: "", focusKeyword: "", secondaryKeywords: "", canonicalUrl: "", ogTitle: "", ogDescription: "", ogImage: "", twitterTitle: "", twitterDescription: "", twitterImage: "", noIndex: false, noFollow: false,
  faqs: [], tagIds: [], links: [{ label: "Download APK (Latest Version)", url: "", version: "", size: "" }],
  editorialRating: 0,
};

async function uploadFile(file: File): Promise<string | null> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd }).catch(() => null);
  if (!res) return null;
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    // On Vercel / read-only hosts the API returns 501 with a helpful message.
    // Surface it so the admin knows to paste an external URL instead.
    if (data?.error) {
      // eslint-disable-next-line no-alert
      alert(`Upload unavailable on this host.\n\n${data.error}\n\nTip: upload the file to Supabase Storage (or any CDN) and paste the public URL into this field.`);
    }
    return null;
  }
  const data = await res.json();
  return data.url as string;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="text-[0.68rem] text-mute mt-1">{hint}</p>}
    </div>
  );
}

export function GameForm({ initial, categories, allTags }: {
  initial?: Partial<GameFormInitial> & { id?: number };
  categories: { id: number; name: string }[];
  allTags: { id: number; name: string }[];
}) {
  const [f, setF] = useState<GameFormInitial>({ ...EMPTY, ...initial });
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [gameName, setGameName] = useState(initial?.title || "");
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  const set = (patch: Partial<GameFormInitial>) => setF((p) => ({ ...p, ...patch }));

  const generateDetails = async () => {
    const name = gameName.trim();
    if (!name) return setGenMsg({ ok: false, text: "Enter a game name first" });
    setGenerating(true);
    setGenMsg(null);
    const res = await fetch("/api/admin/games/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, categoryId: f.categoryId }),
    }).catch(() => null);
    setGenerating(false);
    if (!res) return setGenMsg({ ok: false, text: "Network error" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setGenMsg({ ok: false, text: data.error || "Generation failed" });
    const g = data.fields as {
      title: string; slug: string; shortDesc: string; content: string;
      version: string; size: string; minAndroid: string; developer: string;
      packageName: string; bonus: string; metaTitle: string; metaDescription: string;
      h1?: string; secondaryKeywords?: string; ogTitle?: string; ogDescription?: string; ogImage?: string;
      twitterTitle?: string; twitterDescription?: string; twitterImage?: string;
      focusKeyword: string; canonicalUrl: string; faqs: { q: string; a: string }[];
      tagNames: string[]; editorialRating: number;
    };
    set({
      title: g.title, slug: g.slug, shortDesc: g.shortDesc, content: g.content,
      version: g.version, size: g.size, minAndroid: g.minAndroid, developer: g.developer,
      packageName: g.packageName, bonus: g.bonus, metaTitle: g.metaTitle,
      metaDescription: g.metaDescription, h1: g.h1 || "", focusKeyword: g.focusKeyword,
      secondaryKeywords: g.secondaryKeywords || "", canonicalUrl: g.canonicalUrl,
      ogTitle: g.ogTitle || "", ogDescription: g.ogDescription || "", ogImage: g.ogImage || "",
      twitterTitle: g.twitterTitle || "", twitterDescription: g.twitterDescription || "", twitterImage: g.twitterImage || "",
      faqs: g.faqs, editorialRating: g.editorialRating,
    });
    setNewTag(g.tagNames.join(", "));
    setGenMsg({
      ok: true,
      text: data.duplicate
        ? `Generated. Heads up: "${data.duplicate.title}" already exists (/game/${data.duplicate.slug}) — review before publishing a duplicate.`
        : "Generated — review the fields below, then publish.",
    });
  };

  const autoMeta = () => {
    const year = new Date().getFullYear();
    set({
      metaTitle: `${f.title} APK Download (Latest Version ${f.version}) ${year}`.slice(0, 70),
      metaDescription:
        (f.shortDesc ||
          `View ${f.title} APK version ${f.version} for Android. ${f.bonus ? f.bonus + ". " : ""}Check the listed app details, compatibility information and available download links.`
        ).slice(0, 158),
    });
  };

  const seo = useMemo(() => {
    const kw = f.focusKeyword.toLowerCase().trim();
    const slugV = (f.slug || slugify(f.title)).toLowerCase();
    const checks = [
      { label: "Meta title 30–65 characters", ok: f.metaTitle.length >= 30 && f.metaTitle.length <= 65, pts: 12 },
      { label: "Meta description 120–160 characters", ok: f.metaDescription.length >= 120 && f.metaDescription.length <= 160, pts: 12 },
      { label: "Focus keyword set", ok: kw.length > 0, pts: 8 },
      { label: "Keyword in meta title", ok: kw ? f.metaTitle.toLowerCase().includes(kw) : false, pts: 10 },
      { label: "Keyword in meta description", ok: kw ? f.metaDescription.toLowerCase().includes(kw) : false, pts: 10 },
      { label: "Keyword in URL slug", ok: kw ? slugV.includes(kw.replace(/\s+/g, "-")) : false, pts: 10 },
      { label: "Content has 600+ characters", ok: f.content.length > 600, pts: 10 },
      { label: "App icon uploaded", ok: !!f.icon, pts: 8 },
      { label: "At least one download link", ok: f.links.some((l) => l.url.trim()), pts: 8 },
      { label: "FAQ section added (rich snippets)", ok: f.faqs.length > 0, pts: 7 },
      { label: "Category selected", ok: !!f.categoryId, pts: 5 },
    ];
    const score = checks.reduce((a, c) => a + (c.ok ? c.pts : 0), 0);
    return { checks, score: Math.min(100, Math.round(score)) };
  }, [f]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const payload = {
      ...f,
      slug: f.slug || slugify(f.title),
      newTags: newTag.split(",").map((t) => t.trim()).filter(Boolean),
    };
    const isEdit = !!initial?.id;
    const res = await fetch(isEdit ? `/api/admin/games/${initial!.id}` : "/api/admin/games", {
      method: isEdit ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
    setSaving(false);
    if (!res) return setMsg({ ok: false, text: "Network error" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg({ ok: false, text: data.error || "Save failed" });
    router.push("/admin/games");
    router.refresh();
  };

  return (
    <div className="grid xl:grid-cols-[1fr_300px] gap-6 items-start">
      <div className="space-y-6 min-w-0">
        {/* Quick generate */}
        {!initial?.id && (
          <section className="card-gold p-5 sm:p-6 space-y-3">
            <h2 className="section-title text-lg">Quick Generate</h2>
            <p className="text-xs text-mute -mt-1">
              Type just the game name, optionally pick a category, then generate a full SEO-friendly
              post. Every field below stays editable before you publish.
            </p>
            <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
              <Field label="Game name *">
                <input
                  className="input"
                  value={gameName}
                  onChange={(e) => setGameName(e.target.value)}
                  placeholder="e.g. Yono Bonus"
                />
              </Field>
              <button
                type="button"
                onClick={generateDetails}
                disabled={generating || !gameName.trim()}
                className="btn-gold px-5 py-3 text-sm whitespace-nowrap disabled:opacity-50"
              >
                {generating ? "Generating…" : "✦ Generate Game Details"}
              </button>
            </div>
            {genMsg && (
              <p className={`text-xs rounded-lg px-3 py-2 ${genMsg.ok ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/10 text-rose-400 border border-rose-500/30"}`}>
                {genMsg.text}
              </p>
            )}
          </section>
        )}

        {/* Basics */}
        <section className="card p-5 sm:p-6 space-y-4">
          <h2 className="section-title text-lg">Basic Information</h2>
          <Field label="Game title *">
            <input className="input" value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Diwa Win — Rummy & Slots" />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="URL slug" hint="Leave empty to auto-generate">
              <input className="input font-mono text-sm" value={f.slug} onChange={(e) => set({ slug: slugify(e.target.value) })} placeholder={slugify(f.title) || "auto-slug"} />
            </Field>
            <Field label="Category">
              <select className="input" value={f.categoryId ?? ""} onChange={(e) => set({ categoryId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">— Select —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Short description" hint="Shown under the title & used as meta description fallback">
            <textarea className="input" rows={2} value={f.shortDesc} onChange={(e) => set({ shortDesc: e.target.value })} placeholder="One or two punchy sentences…" />
          </Field>
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={f.featured} onChange={(e) => set({ featured: e.target.checked })} className="accent-[#f5b942] w-4 h-4" />
              Featured on homepage
            </label>
            <label className="flex items-center gap-2 text-sm">
              Status:
              <select className="input !w-auto !py-1.5 text-xs" value={f.status} onChange={(e) => set({ status: e.target.value })}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </label>
          </div>
        </section>

        {/* App details */}
        <section className="card p-5 sm:p-6 space-y-4">
          <h2 className="section-title text-lg">App Details</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Version"><input className="input" value={f.version} onChange={(e) => set({ version: e.target.value })} /></Field>
            <Field label="Size"><input className="input" value={f.size} onChange={(e) => set({ size: e.target.value })} placeholder="34 MB" /></Field>
            <Field label="Min Android"><input className="input" value={f.minAndroid} onChange={(e) => set({ minAndroid: e.target.value })} /></Field>
            <Field label="Developer"><input className="input" value={f.developer} onChange={(e) => set({ developer: e.target.value })} /></Field>
            <Field label="Package name"><input className="input font-mono text-sm" value={f.packageName} onChange={(e) => set({ packageName: e.target.value })} placeholder="com.example.game" /></Field>
            <Field label="Bonus / offer"><input className="input" value={f.bonus} onChange={(e) => set({ bonus: e.target.value })} placeholder="₹78 Bonus Free" /></Field>
            <Field
              label="Editorial rating"
              hint={`Your team's own score (0–5), shown as "Editorial Rating" — separate from real user reviews below and never counted as one.${f.editorialRating ? "" : " 0 = hidden."}`}
            >
              <input
                type="number" min={0} max={5} step={0.1}
                className="input" value={f.editorialRating || ""}
                onChange={(e) => set({ editorialRating: Math.max(0, Math.min(5, Number(e.target.value) || 0)) })}
                placeholder="e.g. 4.2"
              />
            </Field>
          </div>
        </section>

        {/* Media */}
        <section className="card p-5 sm:p-6 space-y-4">
          <h2 className="section-title text-lg">Media</h2>
          <p className="text-[0.68rem] text-mute -mt-2">
            Uploaded files and pasted URLs are both automatically compressed, converted to WebP and hosted locally.
          </p>
          <div className="grid sm:grid-cols-2 gap-5">
            <ImageField
              label="App icon (square)"
              value={f.icon}
              onChange={(url) => set({ icon: url })}
              profile="icon"
              shape="square"
              hint="512×512 recommended"
            />
            <ImageField
              label="Banner (wide)"
              value={f.banner}
              onChange={(url) => set({ banner: url })}
              profile="banner"
              shape="wide"
              hint="1600×900 recommended"
            />
          </div>
        </section>

        {/* Content */}
        <section className="card p-5 sm:p-6 space-y-4">
          <h2 className="section-title text-lg">Description / Article Content</h2>
          <Field label="Description / Article Content (HTML supported)" hint="Write rich HTML for the game article. Unsafe HTML is removed automatically when saved.">
            <HtmlEditor value={f.content} onChange={(content) => set({ content })} rows={14} placeholder={"<h2>About this game</h2>\n<p>Write the game description here…</p>"} />
          </Field>
        </section>

        {/* FAQs */}
        <section className="card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title text-lg">FAQs (rich snippets)</h2>
            <button type="button" onClick={() => set({ faqs: [...f.faqs, { q: "", a: "" }] })} className="btn-ghost px-3 py-1.5 text-xs">+ Add FAQ</button>
          </div>
          {f.faqs.map((faq, i) => (
            <div key={i} className="border border-line rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-mute font-semibold">FAQ #{i + 1}</span>
                <button type="button" onClick={() => set({ faqs: f.faqs.filter((_, j) => j !== i) })} className="text-rose-400 text-xs hover:underline">Remove</button>
              </div>
              <input className="input text-sm" placeholder="Question" value={faq.q} onChange={(e) => set({ faqs: f.faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })} />
              <textarea className="input text-sm" rows={2} placeholder="Answer" value={faq.a} onChange={(e) => set({ faqs: f.faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })} />
            </div>
          ))}
        </section>

        {/* Download links */}
        <section className="card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title text-lg">Download Links</h2>
            <button type="button" onClick={() => set({ links: [...f.links, { label: "Download APK", url: "", version: f.version, size: f.size }] })} className="btn-ghost px-3 py-1.5 text-xs">
              + Add link
            </button>
          </div>
          {f.links.map((l, i) => (
            <div key={i} className="border border-line rounded-xl p-3.5 grid sm:grid-cols-[1fr_2fr_90px_90px_auto] gap-2.5 items-center">
              <input className="input text-sm" placeholder="Label" value={l.label} onChange={(e) => set({ links: f.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              <input className="input text-sm font-mono" placeholder="https://… (or upload a file)" value={l.url} onChange={(e) => set({ links: f.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
              <input className="input text-sm" placeholder="Version" value={l.version} onChange={(e) => set({ links: f.links.map((x, j) => (j === i ? { ...x, version: e.target.value } : x)) })} />
              <input className="input text-sm" placeholder="Size" value={l.size} onChange={(e) => set({ links: f.links.map((x, j) => (j === i ? { ...x, size: e.target.value } : x)) })} />
              <div className="flex gap-2 justify-end">
                <label className="btn-ghost px-2.5 py-1.5 text-xs cursor-pointer whitespace-nowrap" title="Upload APK / ZIP / PDF">
                  ⤒
                  <input type="file" className="hidden" accept=".apk,.zip,.pdf,.bin" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const url = await uploadFile(file);
                    if (url) set({ links: f.links.map((x, j) => (j === i ? { ...x, url, size: x.size || `${(file.size / 1024 / 1024).toFixed(1)} MB` } : x)) });
                    else setMsg({ ok: false, text: "Upload failed (max 100MB)" });
                  }} />
                </label>
                <button type="button" onClick={() => set({ links: f.links.filter((_, j) => j !== i) })} className="text-rose-400 text-xs hover:underline px-1">✕</button>
              </div>
            </div>
          ))}
        </section>

        {/* Tags */}
        <section className="card p-5 sm:p-6 space-y-4">
          <h2 className="section-title text-lg">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {allTags.map((t) => {
              const on = f.tagIds.includes(t.id);
              return (
                <button
                  key={t.id} type="button"
                  onClick={() => set({ tagIds: on ? f.tagIds.filter((x) => x !== t.id) : [...f.tagIds, t.id] })}
                  className={`chip px-3 py-1.5 text-xs ${on ? "!border-accent !text-gold2" : "text-mute"}`}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
          <Field label="Create new tags (comma separated)">
            <input className="input text-sm" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="apk download, latest version…" />
          </Field>
        </section>

        {/* SEO */}
        <section className="card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title text-lg">SEO Settings</h2>
            <button type="button" onClick={autoMeta} className="btn-violet px-3.5 py-1.5 text-xs">✦ Auto-generate meta</button>
          </div>
          <Field label="Focus keyword">
            <input className="input" value={f.focusKeyword} onChange={(e) => set({ focusKeyword: e.target.value })} placeholder="diwa win apk download" />
          </Field>
          <Field label="H1 override" hint="Leave empty to use the game title + APK Download fallback">
            <input className="input" value={f.h1} onChange={(e) => set({ h1: e.target.value })} placeholder={`${f.title} APK Download`} />
          </Field>
          <Field label="Secondary keywords (comma separated)">
            <input className="input" value={f.secondaryKeywords} onChange={(e) => set({ secondaryKeywords: e.target.value })} placeholder={`${f.title} apk, ${f.title} download`} />
          </Field>
          <Field label={`Meta title (${f.metaTitle.length} chars)`}>
            <input className="input" value={f.metaTitle} onChange={(e) => set({ metaTitle: e.target.value })} />
          </Field>
          <Field label={`Meta description (${f.metaDescription.length} chars)`}>
            <textarea className="input" rows={3} value={f.metaDescription} onChange={(e) => set({ metaDescription: e.target.value })} />
          </Field>
          <Field label="Canonical URL" hint="Leave empty to use the default URL">
            <input className="input font-mono text-sm" value={f.canonicalUrl} onChange={(e) => set({ canonicalUrl: e.target.value })} />
          </Field>
                    <div className="grid sm:grid-cols-2 gap-4">
            <Field label="OG title"><input className="input" value={f.ogTitle} onChange={(e) => set({ ogTitle: e.target.value })} /></Field>
            <Field label="OG image URL"><input className="input font-mono text-sm" value={f.ogImage} onChange={(e) => set({ ogImage: e.target.value })} /></Field>
          </div>
          <Field label="OG description"><textarea className="input" rows={2} value={f.ogDescription} onChange={(e) => set({ ogDescription: e.target.value })} /></Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Twitter/X title"><input className="input" value={f.twitterTitle} onChange={(e) => set({ twitterTitle: e.target.value })} /></Field>
            <Field label="Twitter/X image URL"><input className="input font-mono text-sm" value={f.twitterImage} onChange={(e) => set({ twitterImage: e.target.value })} /></Field>
          </div>
          <Field label="Twitter/X description"><textarea className="input" rows={2} value={f.twitterDescription} onChange={(e) => set({ twitterDescription: e.target.value })} /></Field>
<label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={f.noIndex} onChange={(e) => set({ noIndex: e.target.checked })} className="accent-[#f5b942] w-4 h-4" />
            Hide from search engines (noindex)
          </label><label className="flex items-center gap-2 text-sm cursor-pointer mt-2">
            <input type="checkbox" checked={f.noFollow} onChange={(e) => set({ noFollow: e.target.checked })} className="accent-[#f5b942] w-4 h-4" />
            <span>Nofollow page links</span>
          </label>
        </section>
      </div>

      {/* Sticky SEO score + save */}
      <aside className="space-y-4 xl:sticky xl:top-6">
        <div className="card-gold p-5">
          <div className="flex items-end justify-between">
            <p className="label !mb-0">SEO Score</p>
            <p className={`font-display text-4xl leading-none ${seo.score >= 80 ? "gold-text" : seo.score >= 50 ? "text-amber-400" : "text-rose-400"}`}>
              {seo.score}
            </p>
          </div>
          <div className="h-2 rounded-full bg-panel2 mt-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${seo.score}%`,
                background: seo.score >= 80 ? "linear-gradient(90deg,var(--accent),var(--gold2))" : seo.score >= 50 ? "#f59e0b" : "#f43f5e",
              }}
            />
          </div>
          <ul className="mt-4 space-y-2 text-xs">
            {seo.checks.map((c) => (
              <li key={c.label} className={`flex items-start gap-2 ${c.ok ? "text-emerald-400" : "text-mute"}`}>
                <span className="mt-0.5">{c.ok ? "✔" : "○"}</span>
                <span className={c.ok ? "" : "text-mute"}>{c.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {msg && (
          <p className={`text-sm rounded-xl px-4 py-3 ${msg.ok ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/10 text-rose-400 border border-rose-500/30"}`}>
            {msg.text}
          </p>
        )}
        <button onClick={save} disabled={saving || !f.title.trim()} className="btn-gold w-full py-3.5 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50">
          <IconDownload className="w-4 h-4" />
          {saving ? "Saving…" : initial?.id ? "Save Changes" : "Publish Game"}
        </button>
        <Link href="/admin/games" className="btn-ghost w-full py-3 text-sm text-center block">Cancel</Link>
        {f.slug || f.title ? (
          <p className="text-[0.68rem] text-mute break-all">
            URL preview: /game/{f.slug || slugify(f.title)}
          </p>
        ) : null}
      </aside>
    </div>
  );
}
