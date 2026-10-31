import type { Metadata } from "next";

import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Policy gradients from scratch",
    template: "%s | Policy gradients from scratch",
  },
  description:
    "Building a REINFORCE agent from scratch in PyTorch, with a live in-browser demo, training curves from real runs, and a dated experiment log.",
};

/**
 * Sets the theme class before the browser paints, so a reader who prefers dark
 * mode never sees a white flash. It runs from the operating system preference
 * unless an explicit choice was saved by the theme button.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  } catch (error) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-paper text-ink">
        <Nav />
        <main className="mx-auto w-full max-w-3xl grow px-5 py-12 sm:px-8 sm:py-16">
          {children}
        </main>
        <footer className="border-t border-rule">
          <div className="mx-auto w-full max-w-3xl px-5 py-8 text-sm text-muted sm:px-8">
            A deep learning tutorial project. Everything on this site is built
            from the run data in the repository.
          </div>
        </footer>
      </body>
    </html>
  );
}
