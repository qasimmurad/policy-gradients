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
      <p className="mt-3 max-w-xl text-zinc-600 dark:text-zinc-400">
        This page failed to render. Trying again is usually enough, because the
        site is static and nothing here depends on a server.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-zinc-500 dark:text-zinc-500">
          reference {error.digest}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Try again
        </button>
        <a
          href={withBasePath("/")}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Back to the home page
        </a>
      </div>
    </div>
  );
}
