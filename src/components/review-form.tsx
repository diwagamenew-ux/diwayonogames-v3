"use client";

import { useEffect, useState } from "react";
import { IconStar } from "./icons";

export function ReviewForm({ gameId, postId }: { gameId?: number; postId?: number }) {
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [captcha, setCaptcha] = useState<{ token: string; question: string } | null>(null);
  const [state, setState] = useState<{ type: "idle" | "loading" | "ok" | "err"; msg: string }>({ type: "idle", msg: "" });

  const load = () => fetch("/api/forms").then((r) => r.json()).then(setCaptcha).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setState({ type: "loading", msg: "" });
    try {
      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "review",
          gameId, postId, rating,
          name: fd.get("name"),
          comment: fd.get("comment"),
          captchaToken: captcha?.token || "",
          captchaAnswer: fd.get("captchaAnswer"),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setState({ type: "ok", msg: data.message });
        form.reset();
        setRating(5);
        load();
      } else {
        setState({ type: "err", msg: data.error || "Something went wrong" });
        load();
      }
    } catch {
      setState({ type: "err", msg: "Network error. Try again." });
    }
  };

  return (
    <form onSubmit={submit} className="card p-5 sm:p-6 space-y-4">
      <h3 className="font-display text-xl tracking-wide gold-text">Write a Review</h3>
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Your rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className="p-1"
          >
            <IconStar className={`w-7 h-7 transition-colors ${(hover || rating) >= n ? "text-accent" : "text-line"}`} />
          </button>
        ))}
        <span className="text-sm text-mute ml-2">{rating}/5</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <input name="name" required placeholder="Your name" className="input" />
        <div className="flex items-center gap-2">
          <span className="text-sm text-mute whitespace-nowrap">{captcha?.question || "…"}</span>
          <input name="captchaAnswer" required inputMode="numeric" placeholder="?" className="input w-20" aria-label="Captcha" />
        </div>
      </div>
      <textarea name="comment" required rows={3} placeholder="Share your experience with this app…" className="input" />
      {state.msg && (
        <p className={`text-sm rounded-lg px-3.5 py-2.5 ${state.type === "ok" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/10 text-rose-400 border border-rose-500/30"}`}>
          {state.msg}
        </p>
      )}
      <button type="submit" disabled={state.type === "loading"} className="btn-gold px-8 py-3 text-sm disabled:opacity-60">
        {state.type === "loading" ? "Submitting…" : "Submit Review"}
      </button>
    </form>
  );
}
