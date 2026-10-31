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
  /** Two runs are told apart by solid against dashed, not by hue. */
  compare: string;
  trueReward: string;
  proxyReward: string;
};

export function chartColors(theme: Theme): ChartPalette {
  // Matches the paper and ink palette in globals.css. Teal and amber are the
  // only hues, and they mean true reward and proxy reward wherever they appear.
  // Everything else is ink, muted or rule, so a coloured line always carries
  // information rather than decoration.
  return theme === "dark"
    ? {
        axis: "#918b81",
        grid: "#2e2a26",
        tooltipBackground: "#1d1a17",
        tooltipBorder: "#2e2a26",
        raw: "#4a443d",
        average: "#ece8e1",
        loss: "#ece8e1",
        compare: "#ece8e1",
        trueReward: "#5eead4",
        proxyReward: "#e8b339",
      }
    : {
        axis: "#6b6862",
        grid: "#e2dfd8",
        tooltipBackground: "#fbfaf8",
        tooltipBorder: "#e2dfd8",
        raw: "#c7c1b6",
        average: "#1c1b19",
        loss: "#1c1b19",
        compare: "#1c1b19",
        trueReward: "#0f766e",
        proxyReward: "#a65f17",
      };
}
