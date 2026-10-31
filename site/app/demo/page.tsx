import type { Metadata } from "next";

import { DemoSwitcher } from "@/components/DemoSwitcher";
import { loadRunIndex } from "@/lib/content";
import { pickDemoRun, type RunEntry } from "@/lib/runs";

export const metadata: Metadata = {
  title: "Demo",
};

/** Runs that can actually be replayed, best first, filtered to one environment. */
function playable(runs: RunEntry[], matches: (run: RunEntry) => boolean): RunEntry[] {
  const withPolicy = runs.filter((run) => run.has_policy && matches(run));
  const preferred = pickDemoRun(withPolicy);
  return [
    ...withPolicy.filter((run) => run.name === preferred?.name),
    ...withPolicy.filter((run) => run.name !== preferred?.name),
  ];
}

export default function DemoPage() {
  const { runs } = loadRunIndex();

  const cartpole = playable(runs, (run) =>
    (run.env ?? "").toLowerCase().startsWith("cartpole"),
  ).map((run) => ({ name: run.name, baseline: run.baseline }));

  const gridworld = playable(runs, (run) => (run.env ?? "") === "gridworld").map(
    (run) => ({
      name: run.name,
      baseline: run.baseline,
      rewardMode: run.reward_mode,
    }),
  );

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Demo</h1>
        <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Both environments run entirely in your browser, replaying the weights
          that came out of training. Nothing is computed on a server.
        </p>
      </header>

      <DemoSwitcher cartpole={cartpole} gridworld={gridworld} />

      <section className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-sm font-medium">What you are looking at</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          CartPole gives the agent four numbers, the position and velocity of
          the cart and the angle and angular velocity of the pole, and it pushes
          left or right. The gridworld gives it two, its row and column, and it
          moves one square. In both cases the same exported network is doing the
          deciding, through the same forward pass in lib/policy.ts.
        </p>
      </section>
    </div>
  );
}
