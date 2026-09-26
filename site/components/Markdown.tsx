import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { withBasePath } from "@/lib/basePath";

/**
 * Renders a markdown string for the log and the write-up.
 *
 * `remark-gfm` adds tables, strikethrough and task lists on top of standard
 * markdown. Images are written as ordinary markdown and resolve against
 * `public/`, so `![caption](/log-images/reward.png)` works.
 *
 * Rendering happens at build time in a server component, so none of the parser
 * is shipped to the browser.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div
      className={[
        "prose prose-zinc max-w-none dark:prose-invert",
        "prose-headings:font-semibold prose-headings:tracking-tight",
        "prose-a:text-indigo-600 prose-a:underline-offset-2 dark:prose-a:text-indigo-400",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-code:rounded prose-code:bg-zinc-100 prose-code:px-1 prose-code:py-0.5",
        "prose-code:text-[0.85em] prose-code:font-normal dark:prose-code:bg-zinc-800",
        "prose-pre:bg-zinc-100 prose-pre:text-zinc-900 prose-pre:ring-1 prose-pre:ring-zinc-200",
        "dark:prose-pre:bg-zinc-900 dark:prose-pre:text-zinc-100 dark:prose-pre:ring-zinc-800",
        "prose-img:rounded-lg prose-img:ring-1 prose-img:ring-zinc-200 dark:prose-img:ring-zinc-800",
      ].join(" ")}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // A wide table should scroll inside itself rather than push the
          // whole page sideways on a phone.
          table: ({ children: cells }) => (
            <div className="not-prose my-6 overflow-x-auto rounded-lg ring-1 ring-zinc-200 dark:ring-zinc-800">
              <table className="w-full border-collapse text-sm">{cells}</table>
            </div>
          ),
          th: ({ children: cell }) => (
            <th className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-left font-medium dark:border-zinc-800 dark:bg-zinc-900">
              {cell}
            </th>
          ),
          td: ({ children: cell }) => (
            <td className="tabular border-b border-zinc-100 px-3 py-2 last:border-0 dark:border-zinc-800/60">
              {cell}
            </td>
          ),
          // A plain img, because the static export has no image optimiser.
          // Markdown is authored with root relative paths such as
          // /log-images/reward.png, and nothing rewrites those for us, so the
          // base path is applied here.
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={withBasePath(typeof src === "string" ? src : "")} alt={alt ?? ""} />
          ),
          // Same reasoning for a link written to another page of this site.
          a: ({ href, children: label }) => (
            <a href={withBasePath(typeof href === "string" ? href : "")}>{label}</a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
