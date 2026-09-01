"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { SafeImage } from "./safe-image";
import type { SiteSettings } from "@/lib/settings";
import { SearchBox } from "./search-box";
import { ThemeToggle } from "./theme-toggle";
import { IconMenu, IconClose, IconSend, IconGamepad, IconCrown } from "./icons";

export function SiteHeader({ settings, categories }: {
  settings: SiteSettings;
  categories: { name: string; slug: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  // Sane default matching the mobile bar height (h-16 = 64px) so the very
  // first paint has almost no layout jump before the ResizeObserver below
  // measures the real height (which is taller on desktop once the "Top:
  // categories" row is present).
  const [headerH, setHeaderH] = useState(64);

  // Solid, high-contrast header once the page scrolls even a little. A
  // permanently translucent header lets colorful content scrolling
  // underneath show through the logo and menu button.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Keep the spacer below in sync with the header's real rendered height
  // (it changes when the desktop "Top: categories" row appears/disappears
  // at the lg breakpoint, when fonts finish loading, on window resize,
  // etc). The mobile dropdown is a separate `position: absolute` overlay
  // (see below) so opening it does NOT affect this measurement or push
  // page content around.
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height;
      if (h) setHeaderH(Math.round(h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      {/*
        Spacer reserves the header's height in normal document flow, since
        the header itself is `position: fixed` — deliberately, instead of
        `sticky`. `position: sticky` combined with `backdrop-filter` has a
        long-standing WebKit/Safari bug where the element can silently
        "unstick" mid-scroll and scroll away with the page, only appearing
        pinned again once you scroll back to the literal top of the
        document (i.e. exactly "scrolls normally until it reaches the top,
        then sticks" — not truly sticky at all). `position: fixed` has no
        such bug on any browser: the header is pinned to the viewport from
        the very first pixel of scroll, on every platform, with zero
        scroll-dependent behaviour.
      */}
      <div aria-hidden="true" style={{ height: headerH }} />
      <header
        ref={headerRef}
        className={`fixed top-0 inset-x-0 z-[60] isolate border-b transition-[background-color,box-shadow,border-color] duration-200 ${
          scrolled
            ? "bg-panel border-line shadow-lg shadow-black/10"
            : "bg-base/95 border-line/70 backdrop-blur-xl"
        }`}
        style={{ WebkitBackdropFilter: scrolled ? "none" : "blur(24px)" }}
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-3 h-16">
            <Link href="/" className="flex items-center gap-2.5 shrink-0 group" aria-label={settings.siteName}>
              <SafeImage
                src={settings.logoUrl}
                alt={`${settings.siteName} logo`}
                width={40}
                height={40}
                sizes="40px"
                loading="eager"
                fetchPriority="high"
                className="w-10 h-10 rounded-xl object-cover gold-frame bg-panel2 shrink-0 group-hover:scale-105 transition-transform"
              />
              <span className="font-display text-2xl gold-text leading-none pt-0.5 hidden xs:inline sm:inline drop-shadow-sm">
                {settings.siteName.toUpperCase()}
              </span>
            </Link>

            <nav className="hidden lg:flex items-center gap-1 ml-4 text-sm font-medium">
              {settings.nav.headerLinks.map((l, i) => (
                <Link
                  key={l.url + i}
                  href={l.url}
                  className="px-3 py-2 rounded-lg hover:bg-panel2 hover:text-gold2 transition-colors inline-flex items-center gap-1.5"
                >
                  {i === 0 && <IconGamepad className="w-4 h-4 text-accent" />}
                  {l.label}
                </Link>
              ))}
            </nav>

            <div className="flex-1 max-w-md ml-auto hidden md:block">
              <SearchBox />
            </div>

            <div className="flex items-center gap-2 ml-auto md:ml-2">
              {settings.social.telegram && (
                <a
                  href={settings.social.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-telegram px-4 py-2.5 text-xs hidden sm:inline-flex items-center gap-2"
                >
                  <IconSend className="w-4 h-4" /> Join Telegram
                </a>
              )}
              <ThemeToggle />
              <button
                className="header-icon-btn p-2.5 lg:hidden"
                onClick={() => setOpen(!open)}
                aria-label={open ? "Close menu" : "Open menu"}
                aria-expanded={open}
              >
                {open ? <IconClose className="w-5 h-5" /> : <IconMenu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {categories.length > 0 && (
            <div className="hidden lg:flex items-center gap-2 pb-3 overflow-x-auto">
              <span className="text-[0.62rem] uppercase tracking-[0.18em] text-mute shrink-0 inline-flex items-center gap-1.5">
                <IconCrown className="w-3.5 h-3.5 text-accent" /> Top:
              </span>
              {categories.slice(0, 10).map((c) => (
                <Link
                  key={c.slug}
                  href={`/category/${c.slug}`}
                  className="chip px-3.5 py-1.5 text-xs font-medium text-mute whitespace-nowrap"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        {open && (
          // Positioned as an absolute overlay (not inline flow) so opening
          // it never changes the fixed header's own measured height above
          // — it floats over the page content instead of pushing it down.
          <div className="lg:hidden absolute inset-x-0 top-full max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-line bg-panel px-4 py-4 space-y-3 shadow-2xl">
            <SearchBox onNavigate={() => setOpen(false)} />
            <nav className="grid gap-1 text-sm font-medium">
              {settings.nav.headerLinks.map((l, i) => (
                <Link
                  key={l.url + i}
                  href={l.url}
                  onClick={() => setOpen(false)}
                  className="px-3 py-2.5 rounded-lg hover:bg-panel2 transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {categories.slice(0, 12).map((c) => (
                  <Link
                    key={c.slug}
                    href={`/category/${c.slug}`}
                    onClick={() => setOpen(false)}
                    className="chip px-3 py-1.5 text-xs text-mute"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
            {settings.social.telegram && (
              <a
                href={settings.social.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-telegram w-full py-3 text-xs inline-flex items-center justify-center gap-2"
              >
                <IconSend className="w-4 h-4" /> JOIN TELEGRAM NOW
              </a>
            )}
          </div>
        )}
      </header>
    </>
  );
}
