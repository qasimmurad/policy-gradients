import { Card, SyntheticBadge } from "@/components/Card";
import { loadRunIndex, loadWriteup } from "@/lib/content";
import { cartPoleRuns, formatNumber, pickFeaturedRun } from "@/lib/runs";

export default function HomePage() {
  const writeup = loadWriteup();
  const index = loadRunIndex();
  const featured = pickFeaturedRun(cartPoleRuns(index.runs));
  const peak = featured?.summary.peak_moving_average ?? null;

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {writeup.title}
      </h1>

      <div className="mt-6 space-y-5 text-lg leading-relaxed text-zinc-700 dark:text-zinc-300">
        {writeup.intro.length > 0 ? (
          writeup.intro.map((paragraph) => <p key={paragraph.slice(0, 40)}>{paragraph}</p>)
        ) : (
          <p>
            An introduction will appear here once{" "}
            <code className="font-mono text-base">content/writeup.md</code> has
            an <code className="font-mono text-base">intro</code> in its
            frontmatter.
          </p>
        )}
      </div>

      <section
        aria-label="Best result so far"
        className="mt-12 rounded-xl border border-zinc-200 bg-zinc-50 p-8 dark:border-zinc-800 dark:bg-zinc-900/50"
      >
        {peak === null || featured === null ? (
          <>
            <p className="text-4xl font-semibold tracking-tight text-zinc-400 dark:text-zinc-500">
              no runs yet
            </p>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              The best result will appear here after the first training run is
              logged and synced.
            </p>
          </>
        ) : (
          <>
            <p className="tabular text-5xl font-semibold tracking-tight sm:text-6xl">
              {formatNumber(peak, 1)}
            </p>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Peak average reward over{" "}
              {featured.summary.moving_average_window} episodes, from{" "}
              <span className="font-mono">{featured.name}</span>
              {featured.synthetic ? (
                <>
                  {" "}
                  <SyntheticBadge />
                </>
              ) : null}
              . CartPole-v1 caps an episode at 500 steps.
            </p>
            {featured.synthetic ? (
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
                This is made up data from the example run, not a trained policy.
              </p>
            ) : null}
          </>
        )}
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        <Card href="/demo" title="Live demo">
          CartPole running in your browser, with the trained weights loaded from
          the run you pick. Compare the policy against a random agent.
        </Card>
        <Card href="/runs" title="Runs">
          Every training run with its hyperparameters, reward curve and loss
          curve. Two runs can be overlaid to compare them.
        </Card>
        <Card href="/log" title="Experiment log">
          Dated entries on what was tried, what happened, and what changed as a
          result.
        </Card>
        <Card href="/writeup" title="Write-up">
          The report this project is building towards.
        </Card>
      </section>
    </div>
  );
}
