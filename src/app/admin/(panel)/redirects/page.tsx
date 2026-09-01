"use client";

import { useEffect, useState } from "react";

type Redirect = { id: number; fromPath: string; toPath: string; statusCode: number; hits: number };
type NotFound = { id: number; path: string; hits: number; lastSeen: string };

export default function AdminRedirectsPage() {
  const [redirects, setRedirects] = useState<Redirect[]>([]);
  const [notFound, setNotFound] = useState<NotFound[]>([]);
  const [form, setForm] = useState({ fromPath: "", toPath: "", statusCode: 301 });
  const [err, setErr] = useState("");

  const load = () => fetch("/api/admin/redirects").then((r) => r.json()).then((d) => {
    setRedirects(d.redirects || []);
    setNotFound(d.notFound || []);
  }).catch(() => {});
  useEffect(() => { load(); }, []);

  const add = async () => {
    setErr("");
    const res = await fetch("/api/admin/redirects", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setErr(data.error || "Failed");
    else setForm({ fromPath: "", toPath: "", statusCode: 301 });
    load();
  };

  const del = async (id: number, kind = "redirect") => {
    if (!confirm("Delete?")) return;
    await fetch(`/api/admin/redirects?id=${id}&kind=${kind}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl gold-text tracking-wide">REDIRECT MANAGER</h1>
        <p className="text-sm text-mute mt-1">Fix broken URLs and preserve SEO juice with 301/302 redirects.</p>
      </div>

      <div className="card p-5 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="label">From path</label>
          <input className="input font-mono text-sm" value={form.fromPath} onChange={(e) => setForm({ ...form, fromPath: e.target.value })} placeholder="/old-game-apk" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="label">To path or URL</label>
          <input className="input font-mono text-sm" value={form.toPath} onChange={(e) => setForm({ ...form, toPath: e.target.value })} placeholder="/game/new-name or https://…" />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input !w-auto" value={form.statusCode} onChange={(e) => setForm({ ...form, statusCode: Number(e.target.value) })}>
            <option value={301}>301 Permanent</option>
            <option value={302}>302 Temporary</option>
          </select>
        </div>
        <button onClick={add} className="btn-gold px-5 py-2.5 text-sm">Add Redirect</button>
        {err && <p className="w-full text-sm text-rose-400">{err}</p>}
      </div>

      <div className="card overflow-x-auto">
        <table className="admin-table w-full min-w-[560px]">
          <thead><tr><th>From</th><th>To</th><th>Type</th><th>Hits</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {redirects.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-xs">{r.fromPath}</td>
                <td className="font-mono text-xs text-accent">{r.toPath}</td>
                <td className="text-mute">{r.statusCode}</td>
                <td className="text-mute">{r.hits}</td>
                <td className="text-right"><button onClick={() => del(r.id)} className="text-xs text-rose-400 hover:underline">Delete</button></td>
              </tr>
            ))}
            {redirects.length === 0 && <tr><td colSpan={5} className="text-center text-mute py-8">No redirects yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="section-title mb-4">404 Monitor — Broken Link Checker</h2>
        <p className="text-sm text-mute mb-4">These URLs were hit by visitors but returned 404. Create redirects to rescue the traffic.</p>
        <div className="card overflow-x-auto">
          <table className="admin-table w-full min-w-[520px]">
            <thead><tr><th>404 Path</th><th>Hits</th><th>Last seen</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {notFound.map((n) => (
                <tr key={n.id}>
                  <td className="font-mono text-xs">{n.path}</td>
                  <td className="text-mute">{n.hits}</td>
                  <td className="text-mute text-xs">{new Date(n.lastSeen).toLocaleString()}</td>
                  <td className="text-right space-x-3 whitespace-nowrap">
                    <button className="text-xs text-accent hover:underline" onClick={() => setForm({ ...form, fromPath: n.path })}>Create redirect →</button>
                    <button className="text-xs text-rose-400 hover:underline" onClick={() => del(n.id, "notfound")}>Dismiss</button>
                  </td>
                </tr>
              ))}
              {notFound.length === 0 && <tr><td colSpan={4} className="text-center text-mute py-8">No 404s logged. Great!</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
