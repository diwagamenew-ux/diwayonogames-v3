"use client";

import { useEffect, useState } from "react";
import { slugify } from "@/lib/util";

type Page = { id: number; title: string; slug: string; content: string; metaTitle: string; metaDescription: string; h1: string; focusKeyword: string; canonicalUrl: string; ogTitle: string; ogDescription: string; ogImage: string; twitterTitle: string; twitterDescription: string; twitterImage: string; updatedAt: string; noIndex: boolean; noFollow: boolean };
const EMPTY = { title: "", slug: "", content: "", metaTitle: "", metaDescription: "", h1: "", focusKeyword: "", canonicalUrl: "", ogTitle: "", ogDescription: "", ogImage: "", twitterTitle: "", twitterDescription: "", twitterImage: "", noIndex: false, noFollow: false };

export default function AdminPagesPage() {
  const [pages, setPages] = useState<Page[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => fetch("/api/admin/pages").then((r) => r.json()).then((d) => setPages(d.pages || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.title.trim()) return;
    setBusy(true);
    await fetch("/api/admin/pages", {
      method: editId ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, id: editId }),
    }).catch(() => {});
    setBusy(false);
    setForm(EMPTY);
    setEditId(null);
    setOpen(false);
    load();
  };

  const del = async (id: number) => {
    if (!confirm("Delete this page?")) return;
    await fetch(`/api/admin/pages?id=${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-4xl gold-text tracking-wide">PAGES</h1>
        <button onClick={() => { setForm(EMPTY); setEditId(null); setOpen(true); }} className="btn-gold px-5 py-2.5 text-sm">+ New Page</button>
      </div>

      <div className="card overflow-x-auto mb-6">
        <table className="admin-table w-full min-w-[520px]">
          <thead><tr><th>Title</th><th>URL</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.id}>
                <td className="font-semibold">{p.title}</td>
                <td className="text-mute font-mono text-xs">/page/{p.slug}</td>
                <td className="text-right space-x-3 whitespace-nowrap">
                  <a href={`/page/${p.slug}`} target="_blank" className="text-xs text-mute hover:text-accent">View</a>
                  <button className="text-xs text-accent hover:underline" onClick={() => { setEditId(p.id); setForm({ title: p.title, slug: p.slug, content: p.content, metaTitle: p.metaTitle, metaDescription: p.metaDescription, h1: p.h1, focusKeyword: p.focusKeyword, canonicalUrl: p.canonicalUrl, ogTitle: p.ogTitle, ogDescription: p.ogDescription, ogImage: p.ogImage, twitterTitle: p.twitterTitle, twitterDescription: p.twitterDescription, twitterImage: p.twitterImage, noIndex: p.noIndex, noFollow: p.noFollow }); setOpen(true); }}>Edit</button>
                  <button className="text-xs text-rose-400 hover:underline" onClick={() => del(p.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {pages.length === 0 && <tr><td colSpan={3} className="text-center text-mute py-8">No pages yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="card p-5 sm:p-6 space-y-4">
          <h2 className="section-title text-lg">{editId ? "Edit Page" : "New Page"}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Title *</label>
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="label">Slug</label>
              <input className="input font-mono text-sm" value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} placeholder={slugify(form.title)} />
            </div>
          </div>
          <div>
            <label className="label">Content (HTML allowed)</label>
            <textarea className="input font-mono text-sm" rows={12} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">H1</label>
              <input className="input" value={form.h1} onChange={(e) => setForm({ ...form, h1: e.target.value })} placeholder={form.title} />
            </div>
            <div>
              <label className="label">Focus keyword</label>
              <input className="input" value={form.focusKeyword} onChange={(e) => setForm({ ...form, focusKeyword: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Canonical URL</label>
            <input className="input font-mono text-sm" value={form.canonicalUrl} onChange={(e) => setForm({ ...form, canonicalUrl: e.target.value })} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Meta title</label>
              <input className="input" value={form.metaTitle} onChange={(e) => setForm({ ...form, metaTitle: e.target.value })} />
            </div>
            <div>
              <label className="label">Meta description</label>
              <input className="input" value={form.metaDescription} onChange={(e) => setForm({ ...form, metaDescription: e.target.value })} />
            </div>
          </div>
          <div><label className="label">OG title</label><input className="input" value={form.ogTitle} onChange={(e) => setForm({ ...form, ogTitle: e.target.value })} /></div>
          <div><label className="label">OG description</label><textarea className="input" rows={2} value={form.ogDescription} onChange={(e) => setForm({ ...form, ogDescription: e.target.value })} /></div>
          <div><label className="label">OG image URL</label><input className="input font-mono text-sm" value={form.ogImage} onChange={(e) => setForm({ ...form, ogImage: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.noIndex} onChange={(e) => setForm({ ...form, noIndex: e.target.checked })} className="accent-[#f5b942] w-4 h-4" />
            Hide from search engines (noindex)
          </label><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.noFollow} onChange={(e) => setForm({ ...form, noFollow: e.target.checked })} className="accent-[#f5b942] w-4 h-4" /> Nofollow links</label>
          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className="btn-gold px-6 py-2.5 text-sm disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
            <button onClick={() => setOpen(false)} className="btn-ghost px-5 py-2.5 text-sm">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
