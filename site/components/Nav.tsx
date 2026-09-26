"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/demo", label: "Demo" },
  { href: "/runs", label: "Runs" },
  { href: "/log", label: "Log" },
  { href: "/writeup", label: "Write-up" },
];

export function Nav() {
  const pathname = usePathname();
  // Routes are exported with a trailing slash, so compare without it.
  const current = pathname.replace(/\/+$/, "") || "/";

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 sm:px-8">
        <Link
          href="/"
          className="mr-auto text-sm font-semibold tracking-tight hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          Policy gradients from scratch
        </Link>

        <nav aria-label="Main" className="-mx-1 flex items-center gap-1 overflow-x-auto">
          {LINKS.map((link) => {
            const active =
              link.href === "/" ? current === "/" : current.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                ].join(" ")}
              >
                {link.label}
              </Link>
            );
          })}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
