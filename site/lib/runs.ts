/**
 * Shared shapes and pure helpers for run data.
 *
 * `rl/tools/sync.py` writes `public/data/index.json` and copies each run's files
 * into `public/data/runs/<name>/`. The types here mirror that file exactly. Keep
 * the two in step: if the Python side gains a field, add it here too.
 *
 * Nothing in this file touches the filesystem or the network, so both server
 * components and client components can import it.
 */

import { withBasePath } from "./basePath";

export type RunSummary = {
  episodes: number;
  best_reward: number | null;
  final_reward: number | null;
  mean_reward: number | null;
  mean_last_50: number | null;
  peak_moving_average: number | null;
  moving_average_window: number;
  final_loss: number | null;
  has_loss: boolean;
};

export type RunEntry = {
  name: string;
  synthetic: boolean;
  env: string | null;
  config: Record<string, unknown>;
  last_episode: number | null;
  updated_at: string | null;
  has_policy: boolean;
  has_notes: boolean;
  summary: RunSummary;
};

export type RunIndex = {
  moving_average_window: number;
  runs: RunEntry[];
};

export const MOVING_AVERAGE_WINDOW = 20;

/** The number of points a chart will draw before it starts bucketing. */
export const MAX_CHART_POINTS = 1000;

export const EMPTY_INDEX: RunIndex = {
  moving_average_window: MOVING_AVERAGE_WINDOW,
  runs: [],
};

export type MetricPoint = {
  episode: number;
  reward: number | null;
  loss: number | null;
  timestamp?: string;
};

export type ChartPoint = {
  episode: number;
  reward: number | null;
  average: number | null;
  loss: number | null;
};

export function runDataUrl(runName: string, file: string): string {
  // Next does not rewrite bare fetch strings, so the prefix is applied here.
  return withBasePath(`/data/runs/${encodeURIComponent(runName)}/${file}`);
}

/**
 * Parse `metrics.jsonl`. One JSON object per line.
 *
 * A run that was killed mid write can leave a partial final line, and a line
 * missing an episode number is not plottable, so both are skipped rather than
 * throwing and taking the whole page down.
 */
export function parseMetricsJsonl(text: string): MetricPoint[] {
  const points: MetricPoint[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let record: unknown;
    try {
      record = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (typeof record !== "object" || record === null) continue;
    const row = record as Record<string, unknown>;
    if (typeof row.episode !== "number" || !Number.isFinite(row.episode)) continue;
    points.push({
      episode: row.episode,
      reward: finiteOrNull(row.reward),
      loss: finiteOrNull(row.loss),
      timestamp: typeof row.timestamp === "string" ? row.timestamp : undefined,
    });
  }
  points.sort((a, b) => a.episode - b.episode);
  return points;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Trailing moving average of reward.
 *
 * Before `window` episodes have happened the average is taken over whatever is
 * available, so a five episode run still produces a curve instead of a gap.
 * Episodes with no reward recorded are left out of the average rather than
 * counted as zero.
 */
export function movingAverage(
  points: MetricPoint[],
  window: number = MOVING_AVERAGE_WINDOW,
): (number | null)[] {
  return points.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    let total = 0;
    let count = 0;
    for (let i = start; i <= index; i += 1) {
      const reward = points[i].reward;
      if (reward !== null) {
        total += reward;
        count += 1;
      }
    }
    return count === 0 ? null : total / count;
  });
}

export type ChartSeries = {
  points: ChartPoint[];
  /** True when several episodes were averaged into each plotted point. */
  bucketed: boolean;
  /** How many episodes went into each plotted point. */
  bucketSize: number;
  episodes: number;
};

/**
 * Turn raw episodes into something a chart can draw.
 *
 * A run can be five episodes or five thousand. Above `maxPoints` the episodes
 * are averaged into equal buckets, which keeps the shape of the curve and the
 * browser responsive. The moving average is always computed on the full series
 * first, so bucketing never changes what it says.
 */
export function toChartSeries(
  points: MetricPoint[],
  window: number = MOVING_AVERAGE_WINDOW,
  maxPoints: number = MAX_CHART_POINTS,
): ChartSeries {
  const averages = movingAverage(points, window);
  const full: ChartPoint[] = points.map((point, index) => ({
    episode: point.episode,
    reward: point.reward,
    average: averages[index],
    loss: point.loss,
  }));

  if (full.length <= maxPoints) {
    return { points: full, bucketed: false, bucketSize: 1, episodes: full.length };
  }

  const bucketSize = Math.ceil(full.length / maxPoints);
  const bucketed: ChartPoint[] = [];
  for (let start = 0; start < full.length; start += bucketSize) {
    const slice = full.slice(start, start + bucketSize);
    bucketed.push({
      episode: slice[Math.floor(slice.length / 2)].episode,
      reward: mean(slice.map((p) => p.reward)),
      average: mean(slice.map((p) => p.average)),
      loss: mean(slice.map((p) => p.loss)),
    });
  }
  return { points: bucketed, bucketed: true, bucketSize, episodes: full.length };
}

function mean(values: (number | null)[]): number | null {
  let total = 0;
  let count = 0;
  for (const value of values) {
    if (value !== null) {
      total += value;
      count += 1;
    }
  }
  return count === 0 ? null : total / count;
}

/**
 * The run the home page and the demo should show by default.
 *
 * Real runs always win over synthetic ones, however good the synthetic numbers
 * look. Among real runs the best is the one with the highest mean reward over
 * its last fifty episodes, which rewards a policy that ended strong rather than
 * one that got lucky once.
 */
export function pickFeaturedRun(runs: RunEntry[]): RunEntry | null {
  const real = runs.filter((run) => !run.synthetic);
  return bestOf(real.length > 0 ? real : runs);
}

/** The run the demo should load, which must actually have exported weights. */
export function pickDemoRun(runs: RunEntry[]): RunEntry | null {
  const withPolicy = runs.filter((run) => run.has_policy);
  const real = withPolicy.filter((run) => !run.synthetic);
  return bestOf(real.length > 0 ? real : withPolicy);
}

function bestOf(runs: RunEntry[]): RunEntry | null {
  let best: RunEntry | null = null;
  for (const run of runs) {
    const score = run.summary.mean_last_50;
    if (score === null) continue;
    if (best === null || score > (best.summary.mean_last_50 ?? -Infinity)) {
      best = run;
    }
  }
  // A run with no episodes logged yet still deserves to appear somewhere.
  return best ?? runs[0] ?? null;
}

/** Newest first, with synthetic runs pushed to the bottom of the list. */
export function sortRunsForDisplay(runs: RunEntry[]): RunEntry[] {
  return [...runs].sort((a, b) => {
    if (a.synthetic !== b.synthetic) return a.synthetic ? 1 : -1;
    const left = a.updated_at ?? "";
    const right = b.updated_at ?? "";
    if (left !== right) return right.localeCompare(left);
    return a.name.localeCompare(b.name);
  });
}

export function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Config keys the run table shows on their own line rather than in the grid. */
export const HIDDEN_CONFIG_KEYS = new Set(["run_name", "synthetic", "note"]);

export function configRows(config: Record<string, unknown>): [string, string][] {
  return Object.entries(config)
    .filter(([key]) => !HIDDEN_CONFIG_KEYS.has(key))
    .map(([key, value]) => [key, formatConfigValue(value)]);
}

function formatConfigValue(value: unknown): string {
  if (value === null || value === undefined) return "n/a";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/**
 * Runs from the CartPole phase.
 *
 * The headline number on the home page is about CartPole, and the language
 * model phase later adds runs that are scored on something else entirely. If no
 * run declares an environment, every run is returned rather than none, so the
 * page never goes blank over a missing field.
 */
export function cartPoleRuns(runs: RunEntry[]): RunEntry[] {
  const matching = runs.filter((run) =>
    (run.env ?? "").toLowerCase().startsWith("cartpole"),
  );
  return matching.length > 0 ? matching : runs;
}
