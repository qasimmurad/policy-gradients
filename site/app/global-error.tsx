"use client";

import { withBasePath } from "@/lib/basePath";

/**
 * Shown when the root layout itself throws.
 *
 * This replaces the whole document, so it has to provide its own `html` and
 * `body`, and it does not receive `globals.css`. That means no Tailwind here
 * and no theme class, which is why the styles are inline and dark mode is left
 * to the operating system preference.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <title>Something went wrong</title>
        <style>{`
          :root { color-scheme: light dark; }
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 24px;
            background: #ffffff;
            color: #18181b;
            font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          }
          main { max-width: 34rem; }
          h1 { font-size: 1.5rem; letter-spacing: -0.01em; margin: 0 0 12px; }
          p { margin: 0 0 8px; color: #52525b; }
          .ref { font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; color: #71717a; }
          .row { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
          button, a {
            font: inherit;
            font-size: 0.875rem;
            border-radius: 8px;
            padding: 8px 16px;
            cursor: pointer;
            text-decoration: none;
            border: 1px solid #d4d4d8;
            background: transparent;
            color: inherit;
          }
          button { background: #18181b; color: #ffffff; border-color: #18181b; }
          @media (prefers-color-scheme: dark) {
            body { background: #09090b; color: #fafafa; }
            p { color: #a1a1aa; }
            a { border-color: #3f3f46; }
            button { background: #fafafa; color: #18181b; border-color: #fafafa; }
          }
        `}</style>
        <main>
          <h1>Something went wrong</h1>
          <p>
            The site failed to load. Trying again is usually enough, because
            everything here is static and nothing depends on a server.
          </p>
          {error.digest ? <p className="ref">reference {error.digest}</p> : null}
          <div className="row">
            <button type="button" onClick={() => retry()}>
              Try again
            </button>
            <a href={withBasePath("/")}>Back to the home page</a>
          </div>
        </main>
      </body>
    </html>
  );
}
