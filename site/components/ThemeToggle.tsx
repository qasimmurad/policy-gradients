"use client";

import { useEffect } from "react";

import { useResolvedTheme } from "@/lib/theme";

/**
 * Switches between light and dark and remembers the choice.
 *
 * Until a choice is made the site follows the operating system, including when
 * that changes while the page is open. The button writes the `dark` class on
 * the root element and `useResolvedTheme` reads it back, so the class stays the
 * single source of truth and no React state mirrors it.
 */
export function ThemeToggle() {
  const dark = useResolvedTheme() === "dark";

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystem = () => {
      try {
        // An explicit choice wins over the operating system.
        if (localStorage.getItem("theme")) return;
      } catch {
        // Private browsing can refuse storage. Following the system is the
        // right fallback anyway.
      }
      document.documentElement.classList.toggle("dark", media.matches);
    };
    media.addEventListener("change", followSystem);
    return () => media.removeEventListener("change", followSystem);
  }, []);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Nothing to do. The page still switches, the choice just is not saved.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="ml-1 rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      >
        {dark ? (
          <path d="M16.5 11.8A6.8 6.8 0 0 1 8.2 3.5a6.8 6.8 0 1 0 8.3 8.3Z" />
        ) : (
          <>
            <circle cx="10" cy="10" r="3.4" />
            <path d="M10 2.2v1.6M10 16.2v1.6M17.8 10h-1.6M3.8 10H2.2M15.5 4.5l-1.1 1.1M5.6 14.4l-1.1 1.1M15.5 15.5l-1.1-1.1M5.6 5.6 4.5 4.5" />
          </>
        )}
      </svg>
    </button>
  );
}
