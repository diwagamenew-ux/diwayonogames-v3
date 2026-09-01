"use client";

import { useEffect, useState } from "react";

type LogRow = {
  id: number;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  ip: string;
  createdAt: string;
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  update: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  delete: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  login: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  logout: "bg-panel2 text-mute border-line",
  publish: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  approve: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  reject: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch("/api/admin/audit-log")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs || []))
      .catch(() => setLogs([]));
  }, []);

  const filtered = (logs || []).filter((l) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      l.userName.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      l.entity.toLowerCase().includes(q) ||
      l.summary.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl gold-text tracking-wide">AUDIT LOG</h1>
          <p className="text-sm text-mute mt-1">
            Every admin action — who did what, when. Kept for the last 300 entries.
          </p>
        </div>
        <input
          className="input max-w-xs text-sm"
          placeholder="Filter by user, action, entity…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-mute text-xs uppercase tracking-wider border-b border-line">
              <th className="p-3">When</th>
              <th className="p-3">User</th>
              <th className="p-3">Action</th>
              <th className="p-3">Entity</th>
              <th className="p-3">Summary</th>
              <th className="p-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs === null && (
              <tr><td colSpan={6} className="p-6 text-center text-mute">Loading…</td></tr>
            )}
            {logs !== null && filtered.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-mute">No audit entries yet.</td></tr>
            )}
            {filtered.map((l) => (
              <tr key={l.id} className="border-b border-line/60 last:border-0">
                <td className="p-3 text-xs text-mute whitespace-nowrap">
                  {new Date(l.createdAt).toLocaleString()}
                </td>
                <td className="p-3 font-medium">{l.userName || "—"}</td>
                <td className="p-3">
                  <span className={`text-[0.65rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${ACTION_COLORS[l.action] || "bg-panel2 text-mute border-line"}`}>
                    {l.action}
                  </span>
                </td>
                <td className="p-3 text-xs text-mute">
                  {l.entity}{l.entityId ? ` #${l.entityId}` : ""}
                </td>
                <td className="p-3 max-w-xs truncate" title={l.summary}>{l.summary || "—"}</td>
                <td className="p-3 text-xs text-mute font-mono">{l.ip || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
