"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/admin/buttons";

type Item = { id: number; createdAt: string; status: string } & Record<string, string>;
type Data = {
  requests: Item[]; reports: (Item & { gameTitle: string | null })[];
  contacts: Item[]; subscribers: { id: number; email: string; createdAt: string }[];
};

const TABS = [
  { key: "requests", label: "Game Requests" },
  { key: "reports", label: "Broken Links" },
  { key: "contacts", label: "Contact Messages" },
  { key: "subscribers", label: "Newsletter" },
] as const;

export default function AdminInboxPage() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<string>("requests");

  const load = () => fetch("/api/admin/inbox").then((r) => r.json()).then(setData).catch(() => {});
  useEffect(() => { load(); }, []);

  const mark = async (kind: string, id: number, status: string) => {
    await fetch("/api/admin/inbox", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, id, status }) });
    load();
  };
  const del = async (kind: string, id: number) => {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/admin/inbox?kind=${kind}&id=${id}`, { method: "DELETE" });
    load();
  };

  const Actions = ({ kind, item }: { kind: string; item: Item }) => (
    <div className="flex gap-2 mt-3">
      {item.status !== "done" && (
        <button onClick={() => mark(kind, item.id, "done")} className="btn-gold px-3 py-1.5 text-xs">✔ Mark done</button>
      )}
      <button onClick={() => del(kind, item.id)} className="btn-ghost px-3 py-1.5 text-xs text-rose-400">Delete</button>
    </div>
  );

  const DateLine = ({ d }: { d: string }) => (
    <span className="text-[0.65rem] text-mute">{new Date(d).toLocaleString()}</span>
  );

  return (
    <div>
      <h1 className="font-display text-4xl gold-text tracking-wide mb-6">INBOX</h1>
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`chip px-4 py-2 text-xs font-semibold ${tab === t.key ? "!border-accent !text-gold2" : "text-mute"}`}>
            {t.label} ({data ? (data[t.key] as unknown[]).length : "…"})
          </button>
        ))}
      </div>

      {!data && <p className="text-mute">Loading…</p>}
      <div className="space-y-3">
        {data && tab === "requests" && data.requests.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <p className="font-semibold text-sm">🎮 {r.gameName}</p>
              <div className="flex items-center gap-2"><StatusBadge status={r.status} /><DateLine d={r.createdAt} /></div>
            </div>
            <p className="text-xs text-mute mt-1.5">by {r.name} {r.email ? `· ${r.email}` : ""}</p>
            {r.message && <p className="text-sm text-mute mt-2">{r.message}</p>}
            <Actions kind="request" item={r} />
          </div>
        ))}
        {data && tab === "reports" && data.reports.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <p className="font-semibold text-sm">🚩 {r.reason}</p>
              <div className="flex items-center gap-2"><StatusBadge status={r.status} /><DateLine d={r.createdAt} /></div>
            </div>
            <p className="text-xs text-mute mt-1.5">{r.gameTitle ? `Game: ${r.gameTitle} · ` : ""}{r.url}</p>
            {r.message && <p className="text-sm text-mute mt-2">{r.message}</p>}
            <Actions kind="report" item={r} />
          </div>
        ))}
        {data && tab === "contacts" && data.contacts.map((c) => (
          <div key={c.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <p className="font-semibold text-sm">✉ {c.subject || "Message"} — {c.name}</p>
              <div className="flex items-center gap-2"><StatusBadge status={c.status} /><DateLine d={c.createdAt} /></div>
            </div>
            <p className="text-xs text-mute mt-1.5">{c.email}</p>
            <p className="text-sm text-mute mt-2 whitespace-pre-wrap">{c.message}</p>
            <Actions kind="contact" item={c} />
          </div>
        ))}
        {data && tab === "subscribers" && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-sm">{data.subscribers.length} subscribers</p>
              <button
                className="btn-ghost px-3.5 py-1.5 text-xs"
                onClick={() => {
                  const csv = "email,date\n" + data.subscribers.map((s) => `${s.email},${s.createdAt}`).join("\n");
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                  a.download = "subscribers.csv";
                  a.click();
                }}
              >
                ⬇ Export CSV
              </button>
            </div>
            <ul className="divide-y divide-line text-sm">
              {data.subscribers.map((s) => (
                <li key={s.id} className="py-2 flex items-center justify-between">
                  <span>{s.email}</span>
                  <span className="flex items-center gap-3">
                    <DateLine d={s.createdAt} />
                    <button onClick={() => del("subscriber", s.id)} className="text-rose-400 text-xs hover:underline">✕</button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
