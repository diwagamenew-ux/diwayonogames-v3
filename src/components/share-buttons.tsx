"use client";

import { useState } from "react";
import { IconFacebook, IconX, IconWhatsapp, IconSend } from "./icons";

export function ShareButtons({ title, path }: { title: string; path: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.origin + path : path;
  const text = encodeURIComponent(title);
  const link = encodeURIComponent(url);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  const btn = "btn-ghost p-2.5 text-mute hover:text-accent transition-colors";
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-mute uppercase tracking-wider mr-1 hidden sm:inline">Share</span>
      <a className={btn} aria-label="Share on Facebook" target="_blank" rel="noopener noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${link}`}>
        <IconFacebook className="w-4 h-4" />
      </a>
      <a className={btn} aria-label="Share on X" target="_blank" rel="noopener noreferrer" href={`https://twitter.com/intent/tweet?text=${text}&url=${link}`}>
        <IconX className="w-4 h-4" />
      </a>
      <a className={btn} aria-label="Share on WhatsApp" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${text}%20${link}`}>
        <IconWhatsapp className="w-4 h-4" />
      </a>
      <a className={btn} aria-label="Share on Telegram" target="_blank" rel="noopener noreferrer" href={`https://t.me/share/url?url=${link}&text=${text}`}>
        <IconSend className="w-4 h-4" />
      </a>
      <button onClick={copy} className={`${btn} text-xs font-semibold px-3`} aria-label="Copy link">
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
