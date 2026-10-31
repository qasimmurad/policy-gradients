import Link from "next/link";

/**
 * One row in the list of sections on the home page.
 *
 * A row with a rule above it rather than a bordered card. The page is a
 * contents page for a write-up, not a dashboard of tiles.
 */
export function SectionLink({
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
      className="group grid gap-1 border-t border-rule py-5 transition-colors hover:bg-ink/4 sm:grid-cols-[10rem_1fr] sm:gap-6"
    >
      <h3 className="font-serif text-base group-hover:underline group-hover:underline-offset-4">
        {title}
      </h3>
      <p className="max-w-prose text-sm leading-relaxed text-muted">{children}</p>
    </Link>
  );
}

/** Marks a run played by a random agent rather than a trained one. */
export function BaselineBadge() {
  return <span className="label text-proxy">random baseline</span>;
}
