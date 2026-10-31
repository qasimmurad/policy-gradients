# Policy gradients from scratch

A semester deep learning project for a Minerva tutorial. A REINFORCE agent
written from scratch in PyTorch, first on CartPole and then on a small language
model to demonstrate reward hacking and the effect of a KL penalty. Alongside
the code there is a public website with a live in-browser demo of the trained
agent, training curves from real runs, a dated experiment log, and the written
report.

## Reproduce the current results

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Random baselines. These work today.
python rl/agent/reinforce.py --env cartpole  --agent random --episodes 500
python rl/agent/reinforce.py --env gridworld --agent random --episodes 300

# Training runs. These raise NotImplementedError until the bodies in
# rl/agent/reinforce.py are written.
python rl/agent/reinforce.py --env cartpole --episodes 500 --run-name cartpole-v1
python rl/agent/reinforce.py --env gridworld --reward true  --episodes 300 --run-name grid-true
python rl/agent/reinforce.py --env gridworld --reward proxy --episodes 300 --run-name grid-proxy

python rl/tools/sync.py
```

What each run should produce. Baseline figures are measured, on an Apple M3
Pro. The training rows are deliberately empty rather than guessed, and get
filled in once the runs have actually happened.

| Run | What it produces | Time |
| --- | --- | --- |
| `cartpole-random` | Mean reward 22.2 over 500 episodes, best 106. | Under a second |
| `gridworld-random` | Reaches the goal in 97 of 300 episodes. Mean true reward 0.32, mean proxy reward 2.16. | Under a second |
| `cartpole-v1` | **Awaiting Qasim's numbers.** | **Awaiting** |
| `grid-true` | **Awaiting Qasim's numbers.** Should push the goal rate well above the random 97 in 300. | **Awaiting** |
| `grid-proxy` | **Awaiting Qasim's numbers.** The result to look for is proxy reward climbing above the random 2.16 while true reward falls towards zero. | **Awaiting** |

Running `sync.py` copies the runs into the site. `cd site && npm run dev` then
serves it at http://localhost:3000.

## How the code is organised

`rl/agent/` holds the learning algorithm and nothing else. The policy network,
action sampling, returns, the REINFORCE loss and the training loop all live in
one file, so the whole method can be read top to bottom without chasing imports.

Everything around it is support. The environments in `rl/envs/`, the helpers in
`rl/tools/` and the website in `site/` set up the experiments and make the
results visible. They read what training produces and never take part in
producing it, which is why environment construction and the random baseline sit
outside `rl/agent/` even though the training script calls both.

## Layout

```
rl/
  agent/           The learning algorithm, and nothing else.
    reinforce.py     Policy network, action sampling, returns, loss, training loop.
  envs/            CartPole comes from Gymnasium, the gridworld is ours.
    gridworld.py     5 by 5 grid with a true reward and a farmable proxy reward.
  tools/           Logging, weight export, run sync, random baseline. Support code.
  runs/            Output, one folder per run, committed so the site can read it.
    <run-name>/
      config.json    Hyperparameters and environment name.
      metrics.jsonl  One JSON object per episode.
      policy.json    Exported weights, written at the end of a run.
      notes.md       Optional freeform notes.
site/              Next.js app, built as a static export.
  public/data/     Run data copied here by the sync script. Generated, committed.
  content/log/     Experiment log entries, named YYYY-MM-DD-slug.md.
  content/writeup.md
```

## How a run reaches the website

1. The training script creates a `RunLogger`, which makes `rl/runs/<name>/` and
   writes `config.json`.
2. Each episode calls `logger.log(episode, reward, loss)`, appending a line to
   `metrics.jsonl`. Lines are flushed as they are written, so a run can be
   watched while it trains.
3. At the end, `export_policy(model, run_name)` writes `policy.json`: the
   weights of every linear layer as nested lists, rounded to six decimals.
4. `rl/tools/sync.py` copies the runs into `site/public/data/` and writes
   `index.json` with each run's config, last episode and summary numbers.
5. The site reads those files at build time. The demo page fetches a run's
   `policy.json` and runs the forward pass in the browser.

The expected interface for the training script:

```python
from tools.logger import RunLogger
from tools.export import export_policy

with RunLogger("cartpole-baseline", {"env": "CartPole-v1", "lr": 0.01}) as logger:
    for episode in range(n_episodes):
        ...
        logger.log(episode, reward=total_reward, loss=loss.item())
export_policy(model, "cartpole-baseline")
```

## Setup

Python side:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Website:

```bash
cd site
npm install
npm run dev
```

## Commands

| Command | What it does |
| --- | --- |
| `python3 -m unittest discover -s rl/tools -p "test_*.py"` | Tests the tooling. The torch test is skipped if torch is missing. |
| `python3 -m unittest discover -s rl/envs -p "test_*.py"` | Tests the gridworld, including that its proxy reward is still farmable. |
| `python3 rl/tools/sync.py` | Copies runs into the site and rebuilds `index.json`. |
| `npm run dev` (in `site/`) | Development server on port 3000. |
| `npm run sync` (in `site/`) | The sync script, also run automatically before a build. |
| `npm run build` (in `site/`) | Static export into `site/out/`. |
| `npm run preview:pages` (in `site/`) | Builds and serves the GitHub Pages sub-path build on port 4173. |
| `npm run typecheck` and `npm run lint` (in `site/`) | What continuous integration checks. |

Syncing is deterministic. The same runs always produce the same `index.json`, so
running it does not leave a spurious diff behind.

## Baseline runs

`cartpole-random` and `gridworld-random` are a uniformly random agent playing
each environment, produced by `--agent random`. They carry `"baseline": true`
in their config, so the site labels them and the home page will not read one as
a result. They exist to give every trained policy a floor to be measured
against, and they are honest data rather than invented numbers.

As of the last run, random scores a mean of 22 on CartPole, and on the
gridworld it reaches the goal in 97 of 300 episodes for a mean true reward of
0.32 while collecting a mean proxy reward of 2.16. That second pair is already
the Phase 2 story in miniature: the proxy pays out handsomely for wandering
about, and a proxy trained agent only has to push it higher while letting the
true reward fall.

## Notes on the site

Next.js App Router with a static export, Tailwind for styling and Recharts for
the charts. There is no database and no server. Everything the pages show comes
from `public/data` and `content`, read while the site is being built, so nothing
is requested from a third party when a reader opens it.

Two files are worth reading together: `site/lib/policy.ts` replays the exported
network in the browser, and it is meant to be held up against the PyTorch model
line by line. `rl/tools/test_tools.py` exports a small network and checks that
replaying its JSON gives the same action probabilities as torch, which is what
makes the demo trustworthy.

## Deployment

The site is published to GitHub Pages at
**https://qasimmurad.github.io/policy-gradients/** by the `Build and deploy`
workflow, on every push to `main`. Nothing needs to be run by hand.

Pages serves every response with `Cache-Control: max-age=600`, so a push can
take up to ten minutes to show up for somebody who already had the page open. A
green workflow and an apparently unchanged site is usually just that.

Pages serves a project site from a sub-path rather than the domain root, so the
app has to know its own prefix. It reads it from `NEXT_PUBLIC_BASE_PATH`, which
the workflow fills in from `actions/configure-pages`, so the prefix follows the
repository name instead of being hardcoded. `next.config.ts` turns that into
Next's `basePath`, which is enough for `next/link` and every `_next` asset.
Three things Next does not rewrite are handled in `site/lib/basePath.ts`:

- `runDataUrl` in `site/lib/runs.ts`, because the demo and the runs page hand a
  bare string to `fetch`.
- Image and link paths authored inside markdown, applied in
  `site/components/Markdown.tsx`.
- Because the prefix is compiled into the bundle, changing it needs a rebuild
  rather than a redeploy.

The `postbuild` script writes `out/.nojekyll`. Without it Pages runs the export
through Jekyll, which discards every path beginning with an underscore, which
is the whole of `_next/`. Next does not copy dotfiles
out of `public/`, which is why it is written after the export rather than
committed.

To check a Pages style build locally, which is the only way to exercise the
sub-path layout before it is published:

```bash
cd site
npm run preview:pages
```

That builds with the prefix, stages the export under a folder of that name and
serves the parent, so http://localhost:4173/policy-gradients/ behaves the way
the deployed site does. It leaves `site/out` holding a prefixed build, so run
`npm run build` again before serving `out/` at a domain root, or every asset
will 404 and the page will come up unstyled.

Plain `npm run dev` still serves at the root, unprefixed, which is the normal
way to work day to day.

### Vercel

Vercel still works and needs no base path, since it serves from the domain
root. Set the project root directory to `site` and leave
`NEXT_PUBLIC_BASE_PATH` unset. The `verify` job builds the site this way on
every push, so the root configuration cannot quietly rot.
