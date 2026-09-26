/**
 * The path prefix the site is served under.
 *
 * GitHub Pages serves a project site from `https://<user>.github.io/<repo>/`,
 * so the whole app lives under `/<repo>` rather than at the domain root. Vercel
 * and local development serve it at the root. `next.config.ts` reads the same
 * environment variable into `basePath`, which is what makes Next rewrite
 * `next/link` hrefs and the `_next` asset URLs by itself.
 *
 * What Next does not rewrite is a bare string handed to `fetch()`, or a `src`
 * authored inside a markdown file. Those go through `withBasePath`.
 *
 * `NEXT_PUBLIC_` variables are substituted into the client bundle while it is
 * being built, which is the only way a static export can know its own prefix.
 * Changing the prefix therefore requires a rebuild, not just a redeploy.
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

/**
 * Prefix a root relative path with the base path.
 *
 * Anything that is not a root relative path on this site is returned untouched:
 * absolute URLs, protocol relative URLs, fragments, mailto links, and paths
 * that already carry the prefix.
 */
export function withBasePath(path: string): string {
  if (!BASE_PATH || !path) return path;
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) return path;
  return `${BASE_PATH}${path}`;
}
