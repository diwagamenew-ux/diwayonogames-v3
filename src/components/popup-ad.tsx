"use client";

import { useEffect, useState } from "react";
import { IconClose } from "./icons";

export function PopupAd({ code }: { code: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let done = false;
    try {
      done = sessionStorage.getItem("av-popup") === "1";
    } catch {
      /* ignore */
    }
    if (done) return;
    const t = setTimeout(() => {
      setShow(true);
      try {
        sessionStorage.setItem("av-popup", "1");
      } catch {
        /* ignore */
      }
    }, 6000);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="card-gold relative max-w-md w-full p-5">
        <button
          onClick={() => setShow(false)}
          aria-label="Close"
          className="absolute -top-3 -right-3 btn-gold w-8 h-8 rounded-full flex items-center justify-center"
        >
          <IconClose className="w-4 h-4" />
        </button>
        <p className="text-[0.6rem] uppercase tracking-[0.2em] text-mute text-center mb-2">Advertisement</p>
        <div dangerouslySetInnerHTML={{ __html: code }} />
      </div>
    </div>
  );
}
