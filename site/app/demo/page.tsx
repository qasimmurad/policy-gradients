import type { Metadata } from "next";

import { CartPoleDemo, type DemoRun } from "@/components/CartPoleDemo";
import { loadRunIndex } from "@/lib/content";
import { pickDemoRun } from "@/lib/runs";

export const metadata: Metadata = {
  title: "Demo",
};

export default function DemoPage() {
  const index = loadRunIndex();

  // Only runs with exported weights can be replayed. The best real run goes
  // first so it is what the dropdown starts on.
  const withPolicy = index.runs.filter((run) => run.has_policy);
  const preferred = pickDemoRun(index.runs);
  const ordered = [
    ...withPolicy.filter((run) => run.name === preferred?.name),
    ...withPolicy.filter((run) => run.name !== preferred?.name),
  ];
  const runs: DemoRun[] = ordered.map((run) => ({
    name: run.name,
    synthetic: run.synthetic,
  }));

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Demo</h1>
        <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
          CartPole-v1, running in your browser. The physics are the Gymnasium
          equations rewritten in TypeScript, and the action comes from the
          trained network replayed from its exported weights. Nothing is
          computed on a server.
        </p>
      </header>

      <CartPoleDemo runs={runs} />

      <section className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-sm font-medium">What you are looking at</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          The agent sees four numbers: the position and velocity of the cart,
          and the angle and angular velocity of the pole. It chooses to push
          left or right. The episode ends when the pole passes twelve degrees
          from vertical, when the cart reaches the edge of the track, or at 500
          steps, which is the highest score the environment allows.
        </p>
      </section>
    </div>
  );
}
