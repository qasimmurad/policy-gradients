import type { Metadata } from "next";

import { Markdown } from "@/components/Markdown";
import { loadLogEntries } from "@/lib/content";

export const metadata: Metadata = {
  title: "Experiment log",
};

export default function LogPage() {
  const entries = loadLogEntries();

  return (
    <div>
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Experiment log
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
          What was tried, what happened, and what it changed. Newest first.
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No entries yet. Add a markdown file to{" "}
          <code className="font-mono text-sm">content/log</code> named{" "}
          <code className="font-mono text-sm">YYYY-MM-DD-slug.md</code>.
        </p>
      ) : (
        <div className="space-y-14">
          {entries.map((entry) => (
            <article key={`${entry.date}-${entry.slug}`} id={entry.slug} className="scroll-mt-20">
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {entry.title}
              </h2>
              <p className="mt-1 mb-4 font-mono text-sm text-zinc-500 dark:text-zinc-400">
                <time dateTime={entry.date}>{entry.date}</time>
              </p>
              <Markdown>{entry.body}</Markdown>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
