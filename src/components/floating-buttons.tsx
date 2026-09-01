"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SiteSettings } from "@/lib/settings";
import { IconSend, IconWhatsapp, IconMail, IconClose } from "./icons";

export function FloatingButtons({ settings }: { settings: SiteSettings }) {
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const showTelegram = settings.features.telegramFloat && settings.social.telegram;
  const showWhatsapp = settings.features.whatsappFloat && settings.social.whatsapp;
  if (!showTelegram && !showWhatsapp) return null;

  return (
    <div
      className={`fixed bottom-5 right-4 z-40 flex flex-col items-end gap-2.5 transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
    >
      {expanded && (
        <div className="flex flex-col items-end gap-2.5 mb-1">
          {showTelegram && (
            <a
              href={settings.social.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-telegram px-4 py-2.5 text-xs inline-flex items-center gap-2 shadow-xl"
            >
              <IconSend className="w-4 h-4" /> Join Telegram
            </a>
          )}
          {showWhatsapp && (
            <a
              href={settings.social.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 text-xs inline-flex items-center gap-2 rounded-xl bg-emerald-500 text-white font-bold shadow-xl hover:bg-emerald-400 transition-colors"
            >
              <IconWhatsapp className="w-4 h-4" /> WhatsApp
            </a>
          )}
          <Link
            href="/contact"
            className="btn-ghost px-4 py-2.5 text-xs inline-flex items-center gap-2"
          >
            <IconMail className="w-4 h-4" /> Contact Us
          </Link>
        </div>
      )}
      <button
        onClick={() => setExpanded(!expanded)}
        aria-label={expanded ? "Close quick actions" : "Open quick actions"}
        className={`w-[52px] h-[52px] rounded-full flex items-center justify-center shadow-2xl transition-all ${showTelegram ? "btn-telegram" : "btn-gold"} ${expanded ? "" : "animate-glow"}`}
      >
        {expanded ? <IconClose className="w-5 h-5" /> : <IconSend className="w-5 h-5" />}
      </button>
    </div>
  );
}
