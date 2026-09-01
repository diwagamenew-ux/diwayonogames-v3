"use client";

import { useEffect } from "react";

export function ViewTracker({ gameId, postId }: { gameId?: number; postId?: number }) {
  useEffect(() => {
    const key = gameId ? `gv-${gameId}` : `pv-${postId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gameId, postId }),
    }).catch(() => {});
  }, [gameId, postId]);
  return null;
}
