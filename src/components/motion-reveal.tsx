"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

/**
 * Scroll-reveal wrapper — replaces the previous framer-motion implementation
 * (which pulled ~40 KB gzipped of animation runtime into every public page
 * just to fade a card in). This version is ~300 bytes of JS plus a CSS
 * transition: an IntersectionObserver flips a class once the element enters
 * the viewport, and CSS handles the actual animation on the compositor
 * thread (no main-thread work, no layout shift).
 */
export function MotionReveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: ElementType;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Honour users who asked for no motion.
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Component = Tag;
  return (
    <Component
      ref={ref as never}
      data-reveal={shown ? "in" : "out"}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`motion-reveal ${className}`}
    >
      {children}
    </Component>
  );
}
