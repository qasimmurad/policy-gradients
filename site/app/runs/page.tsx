import type { Metadata } from "next";

import { RunExplorer } from "@/components/RunExplorer";
import { loadRunIndex } from "@/lib/content";
import { MOVING_AVERAGE_WINDOW, sortRunsForDisplay } from "@/lib/runs";

export const metadata: Metadata = {
  title: "Runs",
};

export default function RunsPage() {
  const index = loadRunIndex();
  const runs = sortRunsForDisplay(index.runs);

  return (
    <div>
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Runs</h1>
        <p className="mt-3 max-w-2xl text-muted">
          One row per training run. Open a run for its hyperparameters and
          curves, or tick two runs to overlay them.
        </p>
      </header>

      {runs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-rule p-8 text-center text-muted">
          No runs yet. Train something, then run{" "}
          <code className="font-mono text-sm">npm run sync</code>.
        </p>
      ) : (
        <RunExplorer runs={runs} window={index.moving_average_window ?? MOVING_AVERAGE_WINDOW} />
      )}
    </div>
  );
}
