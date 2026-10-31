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
        "prose max-w-none",
        "prose-headings:font-serif prose-headings:font-semibold prose-headings:tracking-tight",
        "prose-a:underline prose-a:underline-offset-[3px] prose-a:decoration-1",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-code:bg-ink/6 prose-code:px-1 prose-code:py-0.5",
        "prose-code:text-[0.85em] prose-code:font-normal",
        "prose-pre:ring-1 prose-pre:ring-rule",
        "prose-img:ring-1 prose-img:ring-rule",
      ].join(" ")}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // A wide table should scroll inside itself rather than push the
          // whole page sideways on a phone.
          table: ({ children: cells }) => (
            <div className="not-prose my-6 overflow-x-auto border-y border-rule">
              <table className="w-full border-collapse text-sm">{cells}</table>
            </div>
          ),
          th: ({ children: cell }) => (
            <th className="label border-b border-rule px-3 py-2 text-left">
              {cell}
            </th>
          ),
          td: ({ children: cell }) => (
            <td className="tabular border-b border-rule/60 px-3 py-2 last:border-0">
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
