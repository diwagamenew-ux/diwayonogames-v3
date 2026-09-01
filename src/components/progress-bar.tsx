"use client";

import { useEffect, useState } from "react";

export function ProgressBar() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const h = document.documentElement;
        const max = h.scrollHeight - h.clientHeight;
        setPct(max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 0);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div className="fixed top-0 left-0 right-0 h-[3px] z-50 bg-transparent pointer-events-none">
      <div
        className="h-full transition-[width] duration-75"
        style={{
          width: `${pct}%`,
          background: "linear-gradient(90deg, var(--primary), var(--accent))",
        }}
      />
    </div>
  );
}
