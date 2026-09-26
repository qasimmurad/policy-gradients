"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CompareChart, LossChart, RewardChart } from "@/components/Charts";
import { SyntheticBadge } from "@/components/Card";
import {
  configRows,
  formatNumber,
  parseMetricsJsonl,
  runDataUrl,
  toChartSeries,
  type ChartSeries,
  type RunEntry,
} from "@/lib/runs";

/**
 * The runs page.
 *
 * The index is known at build time, but `metrics.jsonl` is fetched from
 * `public/data` only when a run is opened or picked for comparison. A five
 * thousand episode run is a few hundred kilobytes, and there is no reason to
 * put every run into the initial HTML when a reader will look at one or two.
 *
 * The fetch is a same origin request for a file that shipped with the build, so
 * the page still works with no network once it has loaded.
 */

type MetricsState =
  | { status: "error"; message: string }
  | { status: "ready"; series: ChartSeries };

export function RunExplorer({
  runs,
  window: averageWindow,
}: {
  runs: RunEntry[];
  window: number;
}) {
  const [expanded, setExpanded] = useState<string[]>(() =>
    runs.length > 0 ? [runs[0].name] : [],
  );
  const [compared, setCompared] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<Record<string, MetricsState>>({});

  const needed = useMemo(
    () => [...new Set([...expanded, ...compared])],
    [expanded, compared],
  );

  // Which runs have had a request started. A ref rather than state, because
  // beginning a fetch should not cause a render, and because it keeps the
  // effect from depending on the very map it writes to.
  const requested = useRef<Set<string>>(new Set());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    for (const name of needed) {
      if (requested.current.has(name)) continue;
      requested.current.add(name);

      fetch(runDataUrl(name, "metrics.jsonl"))
        .then(async (response) => {
          if (response.status === 404) {
            // Pages caches HTML for ten minutes, so a visitor can be holding a
            // run list that the current publish no longer has. That is a stale
            // page, not a broken site.
            throw new Error(
              "This run is no longer published. Reload the page for the current list.",
            );
          }
          if (!response.ok) throw new Error(`metrics.jsonl returned ${response.status}`);
          return response.text();
        })
        .then((text) => {
          if (!mounted.current) return;
          const series = toChartSeries(parseMetricsJsonl(text), averageWindow);
          setMetrics((current) => ({ ...current, [name]: { status: "ready", series } }));
        })
        .catch((error: unknown) => {
          if (!mounted.current) return;
          // Forget the attempt so reopening the run tries again.
          requested.current.delete(name);
          setMetrics((current) => ({
            ...current,
            [name]: {
              status: "error",
              message: error instanceof Error ? error.message : "could not load metrics",
            },
          }));
        });
    }
  }, [needed, averageWindow]);

  const toggleExpanded = useCallback((name: string) => {
    setExpanded((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  }, []);

  const toggleCompared = useCallback((name: string) => {
    setCompared((current) => {
      if (current.includes(name)) return current.filter((item) => item !== name);
      // Two at a time. Picking a third drops the oldest choice.
      return [...current, name].slice(-2);
    });
  }, []);

  const comparable = compared
    .map((name) => ({ name, state: metrics[name] }))
    .filter((entry) => entry.state?.status === "ready")
    .map((entry) => ({
      name: entry.name,
      series: (entry.state as { status: "ready"; series: ChartSeries }).series,
    }));

  return (
    <div>
      {compared.length > 0 ? (
        <section className="mb-10 rounded-xl border border-zinc-200 p-5 sm:p-6 dark:border-zinc-800">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="font-medium">Comparison</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {compared.length === 1
                ? "Pick a second run to overlay."
                : "Two runs overlaid."}
            </p>
            <button
              type="button"
              onClick={() => setCompared([])}
              className="ml-auto rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Clear
            </button>
          </div>

          {comparable.length === 2 ? (
            <CompareChart
              entries={[comparable[0], comparable[1]]}
              window={averageWindow}
            />
          ) : (
            <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {compared.some((name) => metrics[name] === undefined)
                ? "Loading run data."
                : "Select two runs using the compare boxes below."}
            </p>
          )}
        </section>
      ) : null}

      <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {runs.map((run) => {
          const isOpen = expanded.includes(run.name);
          const state = metrics[run.name];

          return (
            <li key={run.name}>
              <div className="flex items-center gap-3 py-4">
                <button
                  type="button"
                  onClick={() => toggleExpanded(run.name)}
                  aria-expanded={isOpen}
                  className="-mx-2 flex grow items-center gap-3 rounded-lg px-2 py-1 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <span
                    aria-hidden="true"
                    className={`text-zinc-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                  >
                    &rsaquo;
                  </span>
                  <span className="min-w-0 grow">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-medium">{run.name}</span>
                      {run.synthetic ? <SyntheticBadge /> : null}
                      {!run.has_policy ? (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          no policy exported
                        </span>
                      ) : null}
                    </span>
                    <span className="tabular mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>{run.summary.episodes} episodes</span>
                      <span>best {formatNumber(run.summary.best_reward, 0)}</span>
                      <span>last 50 avg {formatNumber(run.summary.mean_last_50, 1)}</span>
                      {run.updated_at ? <span>{run.updated_at.slice(0, 10)}</span> : null}
                    </span>
                  </span>
                </button>

                <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={compared.includes(run.name)}
                    onChange={() => toggleCompared(run.name)}
                    className="size-3.5 accent-indigo-600"
                  />
                  <span className="hidden sm:inline">compare</span>
                </label>
              </div>

              {isOpen ? (
                <div className="pb-8">
                  <Hyperparameters run={run} />

                  {state === undefined ? (
                    <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      Loading episodes.
                    </p>
                  ) : null}

                  {state?.status === "error" ? (
                    <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                      Could not load metrics for this run: {state.message}
                    </p>
                  ) : null}

                  {state?.status === "ready" ? (
                    state.series.points.length === 0 ? (
                      <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        No episodes logged for this run yet.
                      </p>
                    ) : (
                      <div className="mt-8 space-y-10">
                        <div>
                          <h3 className="mb-3 text-sm font-medium">Reward per episode</h3>
                          <RewardChart series={state.series} window={averageWindow} />
                        </div>
                        {run.summary.has_loss ? (
                          <div>
                            <h3 className="mb-3 text-sm font-medium">Policy loss</h3>
                            <LossChart series={state.series} />
                          </div>
                        ) : null}
                      </div>
                    )
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Hyperparameters({ run }: { run: RunEntry }) {
  const rows = configRows(run.config);
  const note = typeof run.config.note === "string" ? run.config.note : null;

  return (
    <div>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No config recorded for this run.
        </p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
          {rows.map(([key, value]) => (
            <div key={key} className="min-w-0">
              <dt className="truncate text-xs text-zinc-500 dark:text-zinc-400">{key}</dt>
              <dd className="tabular truncate font-mono">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {note ? (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">{note}</p>
      ) : null}
    </div>
  );
}
