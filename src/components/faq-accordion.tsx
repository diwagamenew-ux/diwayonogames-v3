"use client";

import { useState } from "react";
import { IconChevron } from "./icons";

export function FaqAccordion({ faqs }: { faqs: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  if (!faqs.length) return null;
  return (
    <div className="space-y-3">
      {faqs.map((f, i) => (
        <div key={i} className="card overflow-hidden">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
            className="w-full flex items-center justify-between gap-3 p-4 text-left font-semibold text-sm sm:text-[0.95rem] hover:text-gold2 transition-colors"
          >
            {f.q}
            <IconChevron className={`w-4 h-4 text-accent shrink-0 transition-transform ${open === i ? "rotate-90" : ""}`} />
          </button>
          {open === i && (
            <p className="px-4 pb-4 text-sm text-mute leading-relaxed border-t border-line pt-3">
              {f.a}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
