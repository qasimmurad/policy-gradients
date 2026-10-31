import { SectionLink, BaselineBadge } from "@/components/Card";
import { loadRunIndex, loadWriteup } from "@/lib/content";
import { cartPoleRuns, formatNumber, pickFeaturedRun } from "@/lib/runs";

export default function HomePage() {
  const writeup = loadWriteup();
  const { runs } = loadRunIndex();
  const featured = pickFeaturedRun(cartPoleRuns(runs));
  const peak = featured?.summary.peak_moving_average ?? null;

  return (
    <div>
      <h1 className="text-4xl sm:text-5xl">{writeup.title}</h1>

      <div className="lede mt-8 space-y-5 text-[1.0625rem]">
        {writeup.intro.length > 0 ? (
          writeup.intro.map((paragraph) => <p key={paragraph.slice(0, 40)}>{paragraph}</p>)
        ) : (
          <p>
            An introduction will appear here once{" "}
            <code className="font-mono text-base">content/writeup.md</code> has an{" "}
            <code className="font-mono text-base">intro</code> in its frontmatter.
          </p>
        )}
      </div>

      <section aria-label="Best result so far" className="mt-14 border-t border-rule pt-6">
        {peak === null || featured === null ? (
          <>
            <p className="label">Best result</p>
            <p className="tabular mt-1 font-mono text-4xl text-muted">no runs yet</p>
            <p className="mt-2 max-w-prose text-sm text-muted">
              This will fill in after the first training run is logged and synced.
            </p>
          </>
        ) : (
          <>
            <p className="label">
              Peak average reward over {featured.summary.moving_average_window}{" "}
              episodes
            </p>
            <p className="tabular mt-1 font-mono text-5xl sm:text-6xl">
              {formatNumber(peak, 1)}
            </p>
            <p className="mt-2 flex flex-wrap items-baseline gap-x-3 text-sm text-muted">
              <span>
                from <span className="font-mono">{featured.name}</span>, against a
                cap of 500 steps
              </span>
              {featured.baseline ? <BaselineBadge /> : null}
            </p>
            {featured.baseline ? (
              <p className="mt-3 max-w-prose text-sm text-proxy">
                That is a random agent, which is the floor a trained policy has to
                beat. The number here switches to the best trained run as soon as
                one is logged.
              </p>
            ) : null}
          </>
        )}
      </section>

      <section className="mt-14">
        <SectionLink href="/demo" title="Demo">
          CartPole and the gridworld running in your browser, driven by the weights
          that came out of training. The gridworld view is where the proxy reward
          and the true reward visibly come apart.
        </SectionLink>
        <SectionLink href="/runs" title="Runs">
          Every training run with its hyperparameters and curves. Two runs can be
          overlaid to compare them.
        </SectionLink>
        <SectionLink href="/log" title="Log">
          Dated entries on what was tried, what happened, and what changed as a
          result.
        </SectionLink>
        <SectionLink href="/writeup" title="Write-up">
          The report this is building towards.
        </SectionLink>
        <div className="border-t border-rule" />
      </section>
    </div>
  );
}
