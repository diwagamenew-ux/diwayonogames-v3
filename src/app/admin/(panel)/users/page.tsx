"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/admin/buttons";

type User = { id: number; name: string; email: string; role: string; createdAt: string };
const EMPTY = { name: "", email: "", password: "", role: "author" };
const ROLES = [
  { value: "admin", label: "Admin — full access" },
  { value: "editor", label: "Editor — all content" },
  { value: "author", label: "Author — posts & games" },
  { value: "moderator", label: "Moderator — reviews & inbox" },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => fetch("/api/admin/users").then((r) => r.json()).then((d) => setUsers(d.users || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    setMsg("");
    setBusy(true);
    const res = await fetch("/api/admin/users", {
      method: editId ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, id: editId }),
    }).catch(() => null);
    setBusy(false);
    if (!res) return setMsg("Network error");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data.error || "Failed");
    setForm(EMPTY);
    setEditId(null);
    load();
  };

  const del = async (id: number) => {
    if (!confirm("Delete this user? Their posts will remain.")) return;
    const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(data.error || "Failed");
    load();
  };

  return (
    <div>
      <h1 className="font-display text-4xl gold-text tracking-wide mb-2">USER MANAGEMENT</h1>
      <p className="text-sm text-mute mb-6">Roles control which admin sections each user can access. Passwords are bcrypt-hashed.</p>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="card overflow-x-auto">
          <table className="admin-table w-full min-w-[480px]">
            <thead><tr><th>User</th><th>Role</th><th>Joined</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <p className="font-semibold">{u.name}</p>
                    <p className="text-[0.68rem] text-mute">{u.email}</p>
                  </td>
                  <td><StatusBadge status={u.role === "admin" ? "done" : u.role === "editor" ? "pending" : "new"} /><span className="ml-2 text-xs capitalize text-mute">{u.role}</span></td>
                  <td className="text-mute text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="text-right space-x-3 whitespace-nowrap">
                    <button className="text-xs text-accent hover:underline" onClick={() => { setEditId(u.id); setForm({ name: u.name, email: u.email, password: "", role: u.role }); }}>Edit</button>
                    <button className="text-xs text-rose-400 hover:underline" onClick={() => del(u.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card p-5 space-y-3.5 lg:sticky lg:top-6">
          <h2 className="section-title text-lg">{editId ? "Edit User" : "Add User"}</h2>
          <div>
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Email *</label>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!!editId} />
          </div>
          <div>
            <label className="label">{editId ? "New password (leave empty to keep)" : "Password * (min 6 chars)"}</label>
            <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <label className="label">Role & permissions</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {msg && <p className="text-sm text-rose-400">{msg}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={busy || !form.name || (!editId && (!form.email || form.password.length < 6))} className="btn-gold flex-1 py-2.5 text-sm disabled:opacity-50">
              {busy ? "Saving…" : editId ? "Save changes" : "Create user"}
            </button>
            {editId && <button onClick={() => { setEditId(null); setForm(EMPTY); }} className="btn-ghost px-4 py-2.5 text-sm">Cancel</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
