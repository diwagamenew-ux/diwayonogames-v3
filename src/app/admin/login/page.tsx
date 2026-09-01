"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCrown } from "@/components/icons";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 noise-bg">
      <div className="card-gold w-full max-w-sm p-8">
        <div className="w-14 h-14 mx-auto rounded-2xl btn-gold flex items-center justify-center animate-glow">
          <IconCrown className="w-7 h-7" />
        </div>
        <h1 className="font-display text-3xl text-center mt-5 gold-text tracking-wide">ADMIN PANEL</h1>
        <p className="text-xs text-mute text-center mt-2">Sign in to manage YonoDiwaGames</p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input" placeholder="admin@example.com" autoComplete="email"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password" type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input" placeholder="••••••••" autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3.5 py-2.5">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading} className="btn-gold w-full py-3 text-sm disabled:opacity-60">
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
        <p className="text-[0.68rem] text-mute text-center mt-5">
          Default: admin@yonodiwagames.xyz / admin123 — change it after first login.
        </p>
      </div>
    </div>
  );
}
