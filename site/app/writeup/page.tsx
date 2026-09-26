import type { Metadata } from "next";

import { Markdown } from "@/components/Markdown";
import { loadWriteup } from "@/lib/content";

export const metadata: Metadata = {
  title: "Write-up",
};

export default function WriteupPage() {
  const writeup = loadWriteup();

  return (
    <article>
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {writeup.title}
        </h1>
        {writeup.updated ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            Last updated {writeup.updated}
          </p>
        ) : null}
      </header>

      <Markdown>{writeup.body}</Markdown>
    </article>
  );
}
