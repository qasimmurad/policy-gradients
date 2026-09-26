"use client";

/**
 * Which theme is actually showing right now.
 *
 * Recharts and the demo canvas need real colour values rather than CSS custom
 * properties, so they ask this hook whether they are drawing on a light or a
 * dark background and pick their colours from `chartColors` below.
 *
 * The source of truth is the `dark` class on the root element, which the inline
 * script in app/layout.tsx sets before first paint and the theme button
 * toggles. `useSyncExternalStore` subscribes to that class rather than
 * mirroring it into React state, so there is no extra render on mount and no
 * chance of the two disagreeing.
 */

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** There is no DOM while the page is being built, so assume light and correct on hydration. */
function getServerSnapshot(): Theme {
  return "light";
}

export function useResolvedTheme(): Theme {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export type ChartPalette = {
  axis: string;
  grid: string;
  tooltipBackground: string;
  tooltipBorder: string;
  raw: string;
  average: string;
  loss: string;
  compareA: string;
  compareB: string;
};

export function chartColors(theme: Theme): ChartPalette {
  return theme === "dark"
    ? {
        axis: "#a1a1aa",
        grid: "#27272a",
        tooltipBackground: "#18181b",
        tooltipBorder: "#3f3f46",
        raw: "#71717a",
        average: "#818cf8",
        loss: "#fbbf24",
        compareA: "#818cf8",
        compareB: "#2dd4bf",
      }
    : {
        axis: "#52525b",
        grid: "#e4e4e7",
        tooltipBackground: "#ffffff",
        tooltipBorder: "#d4d4d8",
        raw: "#a1a1aa",
        average: "#4f46e5",
        loss: "#b45309",
        compareA: "#4f46e5",
        compareB: "#0d9488",
      };
}
