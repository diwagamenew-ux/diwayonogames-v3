"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { slugify } from "@/lib/util";
import { ImageField } from "@/components/admin/image-field";
import { HtmlEditor } from "@/components/admin/html-editor";

export type PostFormInitial = {
  id?: number;
  title: string; slug: string; excerpt: string; content: string; image: string;
  categoryId: number | null; status: string; featured: boolean; scheduledAt: string;
  metaTitle: string; metaDescription: string; h1: string; focusKeyword: string; secondaryKeywords: string; canonicalUrl: string; ogTitle: string; ogDescription: string; ogImage: string; twitterTitle: string; twitterDescription: string; twitterImage: string; noIndex: boolean; noFollow: boolean;
  tagIds: number[];
};

const EMPTY: PostFormInitial = {
  title: "", slug: "", excerpt: "", content: "", image: "",
  categoryId: null, status: "published", featured: false, scheduledAt: "",
  metaTitle: "", metaDescription: "", h1: "", focusKeyword: "", secondaryKeywords: "", canonicalUrl: "", ogTitle: "", ogDescription: "", ogImage: "", twitterTitle: "", twitterDescription: "", twitterImage: "", noIndex: false, noFollow: false, tagIds: [],
};

export function PostForm({ initial, categories, allTags }: {
  initial?: Partial<PostFormInitial>;
  categories: { id: number; name: string }[];
  allTags: { id: number; name: string }[];
}) {
  const [f, setF] = useState<PostFormInitial>({ ...EMPTY, ...initial });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  const set = (patch: Partial<PostFormInitial>) => setF((p) => ({ ...p, ...patch }));
  const plainText = f.content.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  const wordCount = plainText ? plainText.split(" ").length : 0;
  const seoChecks = [
    ["Title", f.title.trim().length >= 10],
    ["Excerpt", f.excerpt.trim().length >= 80],
    ["Featured image", !!f.image.trim()],
    ["Focus keyword", !!f.focusKeyword.trim()],
    ["Meta title", f.metaTitle.trim().length >= 20 && f.metaTitle.trim().length <= 65],
    ["Meta description", f.metaDescription.trim().length >= 80 && f.metaDescription.trim().length <= 170],
    ["Content", wordCount >= 500],
  ] as const;
  const seoScore = Math.round((seoChecks.filter(([, ok]) => ok).length / seoChecks.length) * 100);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const isEdit = !!initial?.id;
    const res = await fetch(isEdit ? `/api/admin/posts/${initial!.id}` : "/api/admin/posts", {
      method: isEdit ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...f, slug: f.slug || slugify(f.title), scheduledAt: f.scheduledAt ? new Date(f.scheduledAt).toISOString() : "" }),
    }).catch(() => null);
    setSaving(false);
    if (!res) return setMsg("Network error");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data.error || "Save failed");
    router.push("/admin/posts");
    router.refresh();
  };

  return (
    <div className="grid xl:grid-cols-[1fr_280px] gap-6 items-start">
      <div className="space-y-6 min-w-0">
        <section className="card p-5 sm:p-6 space-y-4">
          <div>
            <label className="label">Post title *</label>
            <input className="input text-lg font-semibold" value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="How to withdraw winnings fast…" />
          </div>
          <div>
            <label className="label">URL slug</label>
            <input className="input font-mono text-sm" value={f.slug} onChange={(e) => set({ slug: slugify(e.target.value) })} placeholder={slugify(f.title) || "auto"} />
          </div>
          <div>
            <label className="label">Excerpt</label>
            <textarea className="input" rows={2} value={f.excerpt} onChange={(e) => set({ excerpt: e.target.value })} placeholder="Short summary shown in lists & meta description" />
          </div>
          <ImageField
            label="Featured image"
            value={f.image}
            onChange={(url) => set({ image: url })}
            profile="banner"
            shape="wide"
            hint="1600×900 recommended — uploads and pasted URLs are both auto-compressed"
          />
          <div>
            <label className="label">Article Content (HTML supported)</label>
            <HtmlEditor value={f.content} onChange={(content) => set({ content })} rows={18} placeholder={"<h2>Write your article heading</h2>\n<p>Write your article here…</p>"} />
          </div>
        </section>

        <section className="card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="section-title text-lg">Content quality</h2><p className="text-xs text-mute mt-1">Helpful checks, not a guarantee of search rankings.</p></div>
            <span className="text-sm font-bold text-gold2">{seoScore}%</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="card p-3"><b>{wordCount}</b><span className="block text-mute">words</span></div>
            <div className="card p-3"><b>{Math.max(1, Math.ceil(wordCount / 200))} min</b><span className="block text-mute">read</span></div>
            <div className="card p-3"><b>{f.title.length}</b><span className="block text-mute">title chars</span></div>
            <div className="card p-3"><b>{f.metaDescription.length}</b><span className="block text-mute">meta chars</span></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-2 text-xs">
            {seoChecks.map(([label, ok]) => <div key={label} className={ok ? "text-emerald-400" : "text-mute"}>{ok ? "✓" : "○"} {label}</div>)}
          </div>
        </section>

        <section className="card p-5 sm:p-6 space-y-4">
          <h2 className="section-title text-lg">SEO</h2>
          <div>
            <label className="label">Focus keyword</label>
            <input className="input" value={f.focusKeyword} onChange={(e) => set({ focusKeyword: e.target.value })} />
          </div>
          <div>
            <label className="label">H1 override</label>
            <input className="input" value={f.h1} onChange={(e) => set({ h1: e.target.value })} placeholder={f.title} />
          </div>
          <div>
            <label className="label">Secondary keywords</label>
            <input className="input" value={f.secondaryKeywords} onChange={(e) => set({ secondaryKeywords: e.target.value })} placeholder="keyword 1, keyword 2" />
          </div>
          <div>
            <label className="label">Meta title ({f.metaTitle.length} chars)</label>
            <input className="input" value={f.metaTitle} onChange={(e) => set({ metaTitle: e.target.value })} placeholder={f.title} />
          </div>
          <div>
            <label className="label">Meta description ({f.metaDescription.length} chars)</label>
            <textarea className="input" rows={2} value={f.metaDescription} onChange={(e) => set({ metaDescription: e.target.value })} placeholder={f.excerpt} />
          </div>
          <div>
            <label className="label">Canonical URL</label>
            <input className="input font-mono text-sm" value={f.canonicalUrl} onChange={(e) => set({ canonicalUrl: e.target.value })} placeholder="Leave empty for automatic canonical" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">OG title</label><input className="input" value={f.ogTitle} onChange={(e) => set({ ogTitle: e.target.value })} /></div>
            <div><label className="label">OG image URL</label><input className="input font-mono text-sm" value={f.ogImage} onChange={(e) => set({ ogImage: e.target.value })} /></div>
          </div>
          <div><label className="label">OG description</label><textarea className="input" rows={2} value={f.ogDescription} onChange={(e) => set({ ogDescription: e.target.value })} /></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">Twitter/X title</label><input className="input" value={f.twitterTitle} onChange={(e) => set({ twitterTitle: e.target.value })} /></div>
            <div><label className="label">Twitter/X image URL</label><input className="input font-mono text-sm" value={f.twitterImage} onChange={(e) => set({ twitterImage: e.target.value })} /></div>
          </div>
          <div><label className="label">Twitter/X description</label><textarea className="input" rows={2} value={f.twitterDescription} onChange={(e) => set({ twitterDescription: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={f.noIndex} onChange={(e) => set({ noIndex: e.target.checked })} className="accent-[#f5b942] w-4 h-4" />
            Hide from search engines (noindex)
          </label><label className="flex items-center gap-2 text-sm cursor-pointer mt-2"><input type="checkbox" checked={f.noFollow} onChange={(e) => set({ noFollow: e.target.checked })} className="accent-[#f5b942] w-4 h-4" /> Nofollow links</label>
        </section>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-6">
        <div className="card p-5 space-y-4">
          <div>
            <label className="label">Status</label>
            <select className="input" value={f.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={f.featured} onChange={(e) => set({ featured: e.target.checked })} className="accent-[#f5b942] w-4 h-4" /> Feature this post on the blog</label>
          {f.status === "scheduled" && <div>
            <label className="label">Publish date & time</label>
            <input className="input" type="datetime-local" value={f.scheduledAt} onChange={(e) => set({ scheduledAt: e.target.value })} />
            <p className="text-xs text-mute mt-1">The post stays private until this time.</p>
          </div>}
          <div>
            <label className="label">Category</label>
            <select className="input" value={f.categoryId ?? ""} onChange={(e) => set({ categoryId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Tags</label>
            <div className="flex flex-wrap gap-2">
              {allTags.map((t) => {
                const on = f.tagIds.includes(t.id);
                return (
                  <button key={t.id} type="button" onClick={() => set({ tagIds: on ? f.tagIds.filter((x) => x !== t.id) : [...f.tagIds, t.id] })} className={`chip px-2.5 py-1 text-xs ${on ? "!border-accent !text-gold2" : "text-mute"}`}>
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {msg && <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">{msg}</p>}
        <button onClick={save} disabled={saving || !f.title.trim()} className="btn-gold w-full py-3.5 text-sm disabled:opacity-50">
          {saving ? "Saving…" : initial?.id ? "Save Changes" : "Publish Post"}
        </button>
        <Link href="/admin/posts" className="btn-ghost w-full py-3 text-sm text-center block">Cancel</Link>
      </aside>
    </div>
  );
}
