"use client";

import { withBasePath } from "@/lib/basePath";

/**
 * Shown when a page throws while rendering.
 *
 * This exists mainly to own the recovery links. Next's built in error screen
 * falls back to `window.location.href = "/"`, which `basePath` does not
 * rewrite, so on GitHub Pages that button sends a reader to the top of
 * github.io rather than back into this project.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-xl text-muted">
        This page failed to render. Trying again is usually enough, because the
        site is static and nothing here depends on a server.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-muted">
          reference {error.digest}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-80"
        >
          Try again
        </button>
        <a
          href={withBasePath("/")}
          className="rounded-lg border border-rule px-4 py-2 text-sm font-medium transition-colors hover:bg-ink/5"
        >
          Back to the home page
        </a>
      </div>
    </div>
  );
}
