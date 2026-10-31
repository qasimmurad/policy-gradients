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
    <header className="border-b border-rule">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-baseline gap-x-6 gap-y-2 px-5 py-5 sm:px-8">
        <Link href="/" className="mr-auto font-serif text-base font-semibold">
          Policy gradients from scratch
        </Link>

        <nav aria-label="Main" className="-mx-1.5 flex items-baseline gap-1 overflow-x-auto">
          {LINKS.map((link) => {
            const active =
              link.href === "/" ? current === "/" : current.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "px-1.5 py-1 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "text-ink underline decoration-1 underline-offset-[6px]"
                    : "text-muted hover:text-ink",
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
