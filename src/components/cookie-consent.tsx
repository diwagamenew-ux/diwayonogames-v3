"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function CookieConsent() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem("av-consent")) setShow(true);
    } catch {
      /* ignore */
    }
  }, []);
  if (!show) return null;
  const accept = () => {
    try {
      localStorage.setItem("av-consent", "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  };
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-3 sm:p-4">
      <div className="card-gold max-w-3xl mx-auto p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-3 sm:gap-5 shadow-2xl">
        <p className="text-xs sm:text-sm text-mute leading-relaxed flex-1">
          We use cookies and similar technologies to improve your experience, analyze traffic and
          serve personalized content. By continuing you accept our{" "}
          <Link href="/page/privacy-policy" className="text-accent hover:underline">Privacy Policy</Link>.
        </p>
        <div className="flex gap-2 shrink-0">
          <button onClick={accept} className="btn-ghost px-4 py-2 text-xs">Decline</button>
          <button onClick={accept} className="btn-gold px-5 py-2 text-xs">Accept</button>
        </div>
      </div>
    </div>
  );
}
