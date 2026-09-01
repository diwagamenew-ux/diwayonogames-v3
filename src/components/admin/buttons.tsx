"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteButton({ endpoint, label = "Delete", confirmText = "Delete this item?", className = "" }: {
  endpoint: string; label?: string; confirmText?: string; className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const del = async () => {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    try {
      await fetch(endpoint, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <button onClick={del} disabled={busy} className={`text-rose-400 hover:underline text-xs disabled:opacity-50 ${className}`}>
      {busy ? "…" : label}
    </button>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    published: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    done: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    draft: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    new: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    rejected: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  };
  return (
    <span className={`text-[0.65rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${colors[status] || "bg-panel2 text-mute border-line"}`}>
      {status}
    </span>
  );
}
