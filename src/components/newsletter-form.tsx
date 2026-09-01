"use client";

import { useState } from "react";
import { IconSend } from "./icons";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<{ type: "idle" | "loading" | "ok" | "err"; msg: string }>({
    type: "idle", msg: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ type: "loading", msg: "" });
    try {
      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "newsletter", email }),
      });
      const data = await res.json();
      if (res.ok) {
        setState({ type: "ok", msg: data.message || "Subscribed!" });
        setEmail("");
      } else {
        setState({ type: "err", msg: data.error || "Something went wrong" });
      }
    } catch {
      setState({ type: "err", msg: "Network error. Try again." });
    }
  };

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          className="input flex-1 min-w-0 text-sm"
          aria-label="Email address"
        />
        <button
          type="submit"
          disabled={state.type === "loading"}
          className="btn-gold px-4 py-2.5 text-sm inline-flex items-center gap-2 disabled:opacity-60"
        >
          <IconSend className="w-4 h-4" />
          <span className="hidden sm:inline">Subscribe</span>
        </button>
      </div>
      {state.msg && (
        <p className={`text-xs mt-2 ${state.type === "ok" ? "text-emerald-400" : "text-rose-400"}`}>
          {state.msg}
        </p>
      )}
    </form>
  );
}
