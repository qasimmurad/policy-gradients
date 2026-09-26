/**
 * Reads everything the pages render, at build time.
 *
 * Run data comes from `public/data`, which `rl/tools/sync.py` fills in before
 * the build. Prose comes from `content/`. Both are ordinary files in the
 * repository, so the built site makes no requests to anything at runtime.
 *
 * Server components only. This module uses `fs`, so a client component must
 * never import it.
 */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

import { EMPTY_INDEX, type RunIndex } from "./runs";

const CONTENT_DIR = path.join(process.cwd(), "content");
const LOG_DIR = path.join(CONTENT_DIR, "log");
const DATA_DIR = path.join(process.cwd(), "public", "data");

/**
 * The run index written by the sync script.
 *
 * A checkout that has never been synced has no index, and that is not an
 * error. The site simply has no runs to show yet.
 */
export function loadRunIndex(): RunIndex {
  const indexPath = path.join(DATA_DIR, "index.json");
  if (!fs.existsSync(indexPath)) return EMPTY_INDEX;
  try {
    const parsed = JSON.parse(fs.readFileSync(indexPath, "utf8")) as RunIndex;
    if (!Array.isArray(parsed.runs)) return EMPTY_INDEX;
    return parsed;
  } catch (error) {
    console.warn(`could not read public/data/index.json, treating it as empty: ${error}`);
    return EMPTY_INDEX;
  }
}

export type LogEntry = {
  slug: string;
  date: string;
  title: string;
  body: string;
};

const LOG_FILENAME = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/;

/**
 * Every markdown file in `content/log`, newest first.
 *
 * Files are named `YYYY-MM-DD-slug.md`. The date and a readable title are taken
 * from the filename unless the frontmatter overrides them.
 */
export function loadLogEntries(): LogEntry[] {
  if (!fs.existsSync(LOG_DIR)) return [];

  const entries: LogEntry[] = [];
  for (const filename of fs.readdirSync(LOG_DIR)) {
    if (!filename.endsWith(".md")) continue;
    const match = LOG_FILENAME.exec(filename);
    if (!match) {
      console.warn(
        `skipping content/log/${filename}, log entries must be named YYYY-MM-DD-slug.md`,
      );
      continue;
    }
    const [, dateFromName, slugFromName] = match;
    const parsed = matter(fs.readFileSync(path.join(LOG_DIR, filename), "utf8"));
    const data = parsed.data as Record<string, unknown>;

    entries.push({
      slug: slugFromName,
      date: typeof data.date === "string" ? data.date : formatDate(data.date) ?? dateFromName,
      title: typeof data.title === "string" ? data.title : titleFromSlug(slugFromName),
      body: parsed.content.trim(),
    });
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date) || b.slug.localeCompare(a.slug));
}

function formatDate(value: unknown): string | null {
  // YAML turns a bare 2026-09-26 into a Date, so turn it back into a plain string.
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return null;
}

function titleFromSlug(slug: string): string {
  return slug.replace(/-/g, " ").replace(/^./, (character) => character.toUpperCase());
}

export type Writeup = {
  title: string;
  intro: string[];
  updated: string | null;
  body: string;
};

/**
 * `content/writeup.md`.
 *
 * The home page shows the `intro` paragraphs from the frontmatter, so the plain
 * language summary and the report itself stay in one file and cannot drift
 * apart.
 */
export function loadWriteup(): Writeup {
  const writeupPath = path.join(CONTENT_DIR, "writeup.md");
  if (!fs.existsSync(writeupPath)) {
    return { title: "Write-up", intro: [], updated: null, body: "Coming soon." };
  }

  const parsed = matter(fs.readFileSync(writeupPath, "utf8"));
  const data = parsed.data as Record<string, unknown>;
  const intro = Array.isArray(data.intro)
    ? data.intro.filter((paragraph): paragraph is string => typeof paragraph === "string")
    : typeof data.intro === "string"
      ? [data.intro]
      : [];

  return {
    title: typeof data.title === "string" ? data.title : "Write-up",
    intro,
    updated: typeof data.updated === "string" ? data.updated : formatDate(data.updated),
    body: parsed.content.trim(),
  };
}
