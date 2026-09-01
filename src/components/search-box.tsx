"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconSearch } from "./icons";

type Result = { id: number; title: string; slug: string; icon: string };

export function SearchBox({ placeholder = "Search apps & games…", autoFocus = false, onNavigate }: {
  placeholder?: string; autoFocus?: boolean; onNavigate?: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const onChange = (v: string) => {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    if (!v.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(v)}`, { signal: controller.signal });
        const data = await res.json();
        setResults(data.results || []);
        setOpen(true);
      } catch {
        /* ignore (includes intentional aborts from a newer keystroke) */
      }
    }, 220);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setOpen(false);
    onNavigate?.();
    router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div ref={boxRef} className="relative w-full">
      <form onSubmit={submit} role="search" className="relative">
        <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mute pointer-events-none" />
        <input
          type="search"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label="Search games"
          className="input pl-10 pr-4 py-2.5 rounded-full text-sm"
        />
      </form>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-2 left-0 right-0 card p-2 max-h-80 overflow-y-auto shadow-2xl">
          {results.map((r) => (
            <Link
              key={r.id}
              href={`/game/${r.slug}`}
              onClick={() => { setOpen(false); onNavigate?.(); }}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-panel2 transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.icon || "/images/logo.png"} alt="" width={36} height={36} className="w-9 h-9 rounded-lg object-cover gold-frame" />
              <span className="text-sm font-medium line-clamp-1">{r.title}</span>
            </Link>
          ))}
          <button
            onClick={submit as never}
            className="w-full text-center text-xs text-accent font-semibold py-2 hover:underline"
          >
            See all results for “{q}”
          </button>
        </div>
      )}
    </div>
  );
}
