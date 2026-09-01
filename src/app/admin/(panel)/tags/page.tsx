"use client";

import { useEffect, useState } from "react";
import { slugify } from "@/lib/util";

type Tag = {
  id: number; name: string; slug: string; count: number;
  metaTitle: string; metaDescription: string; h1: string; focusKeyword: string;
  canonicalUrl: string; noIndex: boolean; noFollow: boolean;
};

const EMPTY = {
  name: "", slug: "", metaTitle: "", metaDescription: "", h1: "",
  focusKeyword: "", canonicalUrl: "", noIndex: true, noFollow: false,
};

export default function AdminTagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => fetch("/api/admin/tags").then((r) => r.json()).then((d) => setTags(d.tags || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    await fetch("/api/admin/tags", {
      method: editId ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, id: editId }),
    }).catch(() => {});
    setBusy(false);
    setForm(EMPTY);
    setEditId(null);
    load();
  };

  const del = async (id: number) => {
    if (!confirm("Delete this tag?")) return;
    await fetch(`/api/admin/tags?id=${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div>
      <h1 className="font-display text-4xl gold-text tracking-wide mb-6">TAGS</h1>
      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="flex flex-wrap gap-2.5">
          {tags.map((t) => (
            <div key={t.id} className="chip pl-3.5 pr-2 py-1.5 text-xs inline-flex items-center gap-2">
              <b>{t.name}</b><span className="text-mute">({t.count})</span>
              <a href={`/tag/${t.slug}`} target="_blank" className="text-mute hover:text-accent" title="View">↗</a>
              <button onClick={() => { setEditId(t.id); setForm({ name: t.name, slug: t.slug, metaTitle: t.metaTitle, metaDescription: t.metaDescription, h1: t.h1, focusKeyword: t.focusKeyword, canonicalUrl: t.canonicalUrl, noIndex: t.noIndex, noFollow: t.noFollow }); }} className="text-accent hover:text-gold2" title="Edit">✎</button>
              <button onClick={() => del(t.id)} className="text-rose-400 hover:text-rose-300" title="Delete">✕</button>
            </div>
          ))}
          {tags.length === 0 && <p className="text-mute text-sm">No tags yet. Tags are also auto-created from the game editor.</p>}
        </div>

        <div className="card p-5 space-y-3.5 lg:sticky lg:top-6">
          <h2 className="section-title text-lg">{editId ? "Edit Tag SEO" : "New Tag"}</h2>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: editId ? form.slug : slugify(e.target.value) })} placeholder="Tag name" />
          <input className="input font-mono text-sm" value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} placeholder="slug" />
          <input className="input" value={form.h1} onChange={(e) => setForm({ ...form, h1: e.target.value })} placeholder="H1 override" />
          <input className="input" value={form.focusKeyword} onChange={(e) => setForm({ ...form, focusKeyword: e.target.value })} placeholder="Focus keyword" />
          <input className="input" value={form.metaTitle} onChange={(e) => setForm({ ...form, metaTitle: e.target.value })} placeholder="Meta title" />
          <textarea className="input" rows={2} value={form.metaDescription} onChange={(e) => setForm({ ...form, metaDescription: e.target.value })} placeholder="Meta description" />
          <input className="input font-mono text-sm" value={form.canonicalUrl} onChange={(e) => setForm({ ...form, canonicalUrl: e.target.value })} placeholder="Canonical URL (optional)" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.noIndex} onChange={(e) => setForm({ ...form, noIndex: e.target.checked })} /> Noindex</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.noFollow} onChange={(e) => setForm({ ...form, noFollow: e.target.checked })} /> Nofollow</label>
          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className="btn-gold flex-1 py-2.5 text-sm">{busy ? "Saving…" : editId ? "Save" : "Add Tag"}</button>
            {editId && <button onClick={() => { setEditId(null); setForm(EMPTY); }} className="btn-ghost px-4 py-2.5 text-sm">Cancel</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
