"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/admin/buttons";
import { Stars } from "@/components/stars";

type Review = {
  id: number; name: string; rating: number; comment: string; status: string;
  createdAt: string; gameTitle: string | null; postTitle: string | null;
};

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState("pending");

  const load = () => fetch("/api/admin/reviews").then((r) => r.json()).then((d) => setReviews(d.reviews || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const setStatus = async (id: number, status: string) => {
    await fetch("/api/admin/reviews", {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status }),
    });
    load();
  };
  const del = async (id: number) => {
    if (!confirm("Delete this review?")) return;
    await fetch(`/api/admin/reviews?id=${id}`, { method: "DELETE" });
    load();
  };

  const filtered = reviews.filter((r) => filter === "all" || r.status === filter);
  const counts = {
    pending: reviews.filter((r) => r.status === "pending").length,
    approved: reviews.filter((r) => r.status === "approved").length,
    rejected: reviews.filter((r) => r.status === "rejected").length,
  };

  return (
    <div>
      <h1 className="font-display text-4xl gold-text tracking-wide mb-6">REVIEWS & COMMENTS</h1>
      <div className="flex gap-2 mb-5">
        {(["pending", "approved", "rejected", "all"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`chip px-4 py-2 text-xs font-semibold capitalize ${filter === s ? "!border-accent !text-gold2" : "text-mute"}`}>
            {s} {s !== "all" ? `(${counts[s]})` : `(${reviews.length})`}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-9 h-9 rounded-full btn-violet flex items-center justify-center font-bold text-sm uppercase">{r.name.charAt(0)}</span>
              <div className="min-w-0">
                <p className="font-semibold text-sm">{r.name}</p>
                <p className="text-[0.68rem] text-mute">
                  on {r.gameTitle ? `🎮 ${r.gameTitle}` : `📝 ${r.postTitle || "—"}`} · {new Date(r.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Stars rating={r.rating} size="w-3.5 h-3.5" showValue={false} className="ml-auto" />
              <StatusBadge status={r.status} />
            </div>
            <p className="text-sm text-mute mt-3">{r.comment}</p>
            <div className="flex gap-2 mt-3">
              {r.status !== "approved" && (
                <button onClick={() => setStatus(r.id, "approved")} className="btn-gold px-3.5 py-1.5 text-xs">✔ Approve</button>
              )}
              {r.status !== "rejected" && (
                <button onClick={() => setStatus(r.id, "rejected")} className="btn-ghost px-3.5 py-1.5 text-xs text-amber-400">Reject</button>
              )}
              <button onClick={() => del(r.id)} className="btn-ghost px-3.5 py-1.5 text-xs text-rose-400">Delete</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="card p-10 text-center text-mute text-sm">Nothing here.</div>}
      </div>
    </div>
  );
}
