"use client";

import { useEffect, useState } from "react";
import { IconSun, IconMoon } from "./icons";

export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);
  const toggle = () => {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem("av-theme", next ? "light" : "dark");
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      onClick={toggle}
      aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
      className="header-icon-btn p-2.5 text-mute hover:text-accent"
    >
      {light ? <IconMoon className="w-4.5 h-4.5 w-[18px] h-[18px]" /> : <IconSun className="w-[18px] h-[18px]" />}
    </button>
  );
}
