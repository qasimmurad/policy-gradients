import Link from "next/link";

export function Card({
  href,
  title,
  children,
}: {
  href: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-zinc-200 p-6 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
    >
      <h3 className="flex items-center gap-1.5 font-medium">
        {title}
        <span
          aria-hidden="true"
          className="text-zinc-400 transition-transform group-hover:translate-x-0.5"
        >
          &rarr;
        </span>
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {children}
      </p>
    </Link>
  );
}

export function SyntheticBadge() {
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
      synthetic
    </span>
  );
}
