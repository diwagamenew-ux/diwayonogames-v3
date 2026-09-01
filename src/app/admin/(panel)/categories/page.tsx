"use client";

import { useEffect, useState } from "react";
import { slugify } from "@/lib/util";
import { ImageField } from "@/components/admin/image-field";

type Cat = { id: number; name: string; slug: string; description: string; icon: string; metaTitle: string; metaDescription: string; h1: string; focusKeyword: string; canonicalUrl: string; ogTitle: string; ogDescription: string; ogImage: string; twitterTitle: string; twitterDescription: string; twitterImage: string; noIndex: boolean; noFollow: boolean };
const EMPTY = { name: "", slug: "", description: "", icon: "", metaTitle: "", metaDescription: "", h1: "", focusKeyword: "", canonicalUrl: "", ogTitle: "", ogDescription: "", ogImage: "", twitterTitle: "", twitterDescription: "", twitterImage: "", noIndex: false, noFollow: false };

export default function AdminCategoriesPage() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => fetch("/api/admin/categories").then((r) => r.json()).then((d) => setCats(d.categories || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    await fetch("/api/admin/categories", {
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
    if (!confirm("Delete this category? Games will keep no category.")) return;
    await fetch(`/api/admin/categories?id=${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div>
      <h1 className="font-display text-4xl gold-text tracking-wide mb-6">CATEGORIES</h1>
      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="card overflow-x-auto">
          <table className="admin-table w-full min-w-[420px]">
            <thead><tr><th>Name</th><th>Slug</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id}>
                  <td className="font-semibold">{c.name}</td>
                  <td className="text-mute font-mono text-xs">/{c.slug}</td>
                  <td className="text-right space-x-3 whitespace-nowrap">
                    <button className="text-xs text-accent hover:underline" onClick={() => { setEditId(c.id); setForm({ name: c.name, slug: c.slug, description: c.description, icon: c.icon, metaTitle: c.metaTitle, metaDescription: c.metaDescription, h1: c.h1, focusKeyword: c.focusKeyword, canonicalUrl: c.canonicalUrl, ogTitle: c.ogTitle, ogDescription: c.ogDescription, ogImage: c.ogImage, twitterTitle: c.twitterTitle, twitterDescription: c.twitterDescription, twitterImage: c.twitterImage, noIndex: c.noIndex, noFollow: c.noFollow }); }}>Edit</button>
                    <button className="text-xs text-rose-400 hover:underline" onClick={() => del(c.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {cats.length === 0 && <tr><td colSpan={3} className="text-center text-mute py-8">No categories yet.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card p-5 space-y-3.5 lg:sticky lg:top-6">
          <h2 className="section-title text-lg">{editId ? "Edit Category" : "New Category"}</h2>
          <div>
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Rummy Games" />
          </div>
          <div>
            <label className="label">Slug</label>
            <input className="input font-mono text-sm" value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} placeholder={slugify(form.name)} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <ImageField
            label="Icon (optional)"
            value={form.icon}
            onChange={(url) => setForm({ ...form, icon: url })}
            profile="icon"
            shape="square"
          />
          <div>
            <label className="label">H1</label>
            <input className="input" value={form.h1} onChange={(e) => setForm({ ...form, h1: e.target.value })} placeholder={form.name} />
          </div>
          <div>
            <label className="label">Focus keyword</label>
            <input className="input" value={form.focusKeyword} onChange={(e) => setForm({ ...form, focusKeyword: e.target.value })} />
          </div>
          <div>
            <label className="label">Canonical URL</label>
            <input className="input font-mono text-sm" value={form.canonicalUrl} onChange={(e) => setForm({ ...form, canonicalUrl: e.target.value })} />
          </div>
          <div>
            <label className="label">Meta title</label>
            <input className="input" value={form.metaTitle} onChange={(e) => setForm({ ...form, metaTitle: e.target.value })} placeholder={`${form.name} APK Download`} />
          </div>
          <div>
            <label className="label">Meta description</label>
            <textarea className="input" rows={2} value={form.metaDescription} onChange={(e) => setForm({ ...form, metaDescription: e.target.value })} />
          </div>
          <div><label className="label">OG title</label><input className="input" value={form.ogTitle} onChange={(e) => setForm({ ...form, ogTitle: e.target.value })} /></div>
          <div><label className="label">OG description</label><textarea className="input" rows={2} value={form.ogDescription} onChange={(e) => setForm({ ...form, ogDescription: e.target.value })} /></div>
          <div><label className="label">OG image URL</label><input className="input font-mono text-sm" value={form.ogImage} onChange={(e) => setForm({ ...form, ogImage: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.noIndex} onChange={(e) => setForm({ ...form, noIndex: e.target.checked })} className="accent-[#f5b942] w-4 h-4" />
            Hide from search engines (noindex)
          </label><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.noFollow} onChange={(e) => setForm({ ...form, noFollow: e.target.checked })} className="accent-[#f5b942] w-4 h-4" /> Nofollow links</label>
          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className="btn-gold flex-1 py-2.5 text-sm disabled:opacity-50">{editId ? "Save" : "Create"}</button>
            {editId && <button onClick={() => { setEditId(null); setForm(EMPTY); }} className="btn-ghost px-4 py-2.5 text-sm">Cancel</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
