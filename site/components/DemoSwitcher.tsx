"use client";

import { useState } from "react";

import { CartPoleDemo, type DemoRun as CartPoleRun } from "./CartPoleDemo";
import { GridWorldDemo, type DemoRun as GridWorldRun } from "./GridWorldDemo";

/**
 * Picks which environment the demo page is showing.
 *
 * Only one is mounted at a time, so the other one's animation loop is not
 * running in the background burning frames on something nobody is looking at.
 */
export function DemoSwitcher({
  cartpole,
  gridworld,
}: {
  cartpole: CartPoleRun[];
  gridworld: GridWorldRun[];
}) {
  const [environment, setEnvironment] = useState<"cartpole" | "gridworld">("cartpole");

  return (
    <div>
      <div className="mb-8 flex gap-6 border-b border-zinc-200 dark:border-zinc-800">
        {(
          [
            ["cartpole", "CartPole"],
            ["gridworld", "Gridworld"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setEnvironment(key)}
            aria-current={environment === key ? "page" : undefined}
            className={[
              "-mb-px border-b-2 px-1 pb-3 text-sm transition-colors",
              environment === key
                ? "border-zinc-900 font-medium text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {environment === "cartpole" ? (
        <>
          <p className="mb-8 max-w-2xl text-zinc-600 dark:text-zinc-400">
            Balance a pole on a moving cart. The physics are the Gymnasium
            equations rewritten in TypeScript, and the action comes from the
            trained network replayed from its exported weights.
          </p>
          <CartPoleDemo runs={cartpole} />
        </>
      ) : (
        <>
          <p className="mb-8 max-w-2xl text-zinc-600 dark:text-zinc-400">
            Reach the bottom right corner. The agent is paid a proxy reward that
            gives +0.1 for a step towards the goal and takes only 0.01 back for a
            step away, so stepping off the goal and back pays +0.09 every two
            steps and never ends the episode. Watch the two counters separate.
          </p>
          <GridWorldDemo runs={gridworld} />
        </>
      )}
    </div>
  );
}
