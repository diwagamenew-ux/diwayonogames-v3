"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";

/**
 * Defense-in-depth wrapper around next/image. Even after the compression
 * pipeline (see lib/image-optim.ts + /api/upload + /api/upload/from-url),
 * an admin can still save a raw external URL without running it through
 * "Fetch & Compress" — and free image hosts frequently block hotlinked
 * requests, redirect unpredictably, rate-limit, or go offline entirely.
 * When that happens the *page itself* used to break: Next's image
 * optimizer throws for that `<Image>`, and the element renders as a
 * broken-image icon (or, in some server-render paths, an error).
 *
 * SafeImage catches that failure client-side and swaps to a guaranteed-
 * local fallback asset, so an image field left pointing at a dead/blocked
 * external URL degrades to a clean placeholder instead of "not showing".
 * This is on top of, not instead of, the ingestion-time compression —
 * both layers matter.
 */
export function SafeImage({
  fallbackSrc = "/images/logo.png",
  ...props
}: ImageProps & { fallbackSrc?: string }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? fallbackSrc : props.src;

  return (
    <Image
      {...props}
      src={src}
      // The fallback is a known-good local asset — never re-run it through
      // the remote optimizer/hotlink path, and never loop if it also 404s.
      unoptimized={failed ? true : props.unoptimized}
      onError={() => {
        if (!failed) setFailed(true);
      }}
    />
  );
}
