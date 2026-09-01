"use client";

import { useEffect, useState } from "react";

export type ImageProfile = "icon" | "banner" | "logo" | "favicon" | "content" | "generic";

type UploadResult = {
  ok?: boolean;
  url?: string;
  width?: number;
  height?: number;
  originalBytes?: number;
  optimizedBytes?: number;
  savedPct?: number;
  error?: string;
};

function fmtBytes(n: number): string {
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + " MB";
  if (n >= 1024) return (n / 1024).toFixed(1) + " KB";
  return n + " B";
}

async function postJson(url: string, body: unknown): Promise<UploadResult | null> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res) return { error: "Network error" };
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data?.error || `Request failed (${res.status})` };
  return data as UploadResult;
}

async function postFile(file: File, profile: ImageProfile): Promise<UploadResult | null> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("profile", profile);
  const res = await fetch("/api/upload", { method: "POST", body: fd }).catch(() => null);
  if (!res) return { error: "Network error" };
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data?.error || `Upload failed (${res.status})` };
  return data as UploadResult;
}

/**
 * Universal image input used for every image field in the admin panel
 * (logo, favicon, game icon/banner, post featured image). Every path —
 * uploading a file OR pasting an external URL — routes through the sharp
 * compression pipeline server-side and ends up as a small, locally-hosted
 * file under /uploads. This is what guarantees the image both (a) actually
 * displays (no more dependency on a possibly hotlink-blocked external
 * host) and (b) is compressed automatically, matching the requirement that
 * uploads AND pasted URLs both get optimized.
 */
export function ImageField({
  label,
  value,
  onChange,
  profile,
  shape = "square",
  hint,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  profile: ImageProfile;
  shape?: "square" | "wide";
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [draft, setDraft] = useState(value);

  // Keep the text field in sync if the parent loads a different record
  // (e.g. navigating from "New Game" to editing an existing one) without
  // fighting the user's own typing — we only ever overwrite `draft` here
  // when the incoming `value` actually changes from outside.
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const isExternal = /^https?:\/\//i.test(value.trim());
  const box = shape === "square" ? "w-16 h-16 rounded-xl" : "h-16 w-32 rounded-xl";

  const runUpload = async (file: File) => {
    setBusy(true);
    setStatus(null);
    const res = await postFile(file, profile);
    setBusy(false);
    if (res?.url) {
      onChange(res.url);
      setDraft(res.url);
      const saved = res.originalBytes && res.optimizedBytes
        ? `${fmtBytes(res.originalBytes)} → ${fmtBytes(res.optimizedBytes)} (${res.savedPct ?? 0}% smaller)`
        : "optimized";
      setStatus({ ok: true, text: `Uploaded & compressed: ${saved}` });
    } else {
      setStatus({ ok: false, text: res?.error || "Upload failed" });
    }
  };

  const runOptimizeUrl = async () => {
    const url = draft.trim();
    if (!url) return;
    if (url.startsWith("/")) {
      setStatus({ ok: true, text: "Already a local file — nothing to fetch." });
      return;
    }
    setBusy(true);
    setStatus(null);
    const res = await postJson("/api/upload/from-url", { url, profile });
    setBusy(false);
    if (res?.url) {
      onChange(res.url);
      setDraft(res.url);
      const saved = res.originalBytes && res.optimizedBytes
        ? `${fmtBytes(res.originalBytes)} → ${fmtBytes(res.optimizedBytes)} (${res.savedPct ?? 0}% smaller)`
        : "optimized";
      setStatus({ ok: true, text: `Fetched & compressed: ${saved}` });
    } else {
      setStatus({ ok: false, text: res?.error || "Could not fetch that URL" });
    }
  };

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-start gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className={`object-cover gold-frame shrink-0 ${box}`} />
        ) : (
          <div className={`bg-panel2 border border-dashed border-line flex items-center justify-center text-mute text-xs shrink-0 ${box}`}>
            None
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex gap-2">
            <input
              className="input !py-1.5 text-xs flex-1 min-w-0"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => { if (draft !== value) onChange(draft); }}
              placeholder="/uploads/… or https://…"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="btn-ghost inline-flex px-3 py-1.5 text-xs cursor-pointer">
              {busy ? "Working…" : "Upload file"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) runUpload(file);
                  e.target.value = "";
                }}
              />
            </label>
            {isExternal && (
              <button
                type="button"
                disabled={busy}
                onClick={runOptimizeUrl}
                className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-50"
                title="Download this external image, compress it, and host it locally"
              >
                {busy ? "Optimizing…" : "⚡ Fetch & Compress URL"}
              </button>
            )}
          </div>
          {status && (
            <p className={`text-[0.68rem] ${status.ok ? "text-emerald-400" : "text-rose-400"}`}>{status.text}</p>
          )}
          {hint && !status && <p className="text-[0.68rem] text-mute">{hint}</p>}
        </div>
      </div>
    </div>
  );
}
