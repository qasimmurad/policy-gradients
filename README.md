# Policy gradients from scratch

A semester deep learning project for a Minerva tutorial. A REINFORCE agent
written from scratch in PyTorch, first on CartPole and then on a small language
model to demonstrate reward hacking and the effect of a KL penalty. Alongside
the code there is a public website with a live in-browser demo of the trained
agent, training curves from real runs, a dated experiment log, and the written
report.

## Division of labour

This matters more than anything else in this file.

**Qasim writes the reinforcement learning.** The REINFORCE implementation, the
policy network, the loss and the update rule live in `rl/agent/` and are written
by hand, because every line has to be explainable in an interview. Nothing and
nobody else writes in that directory.

**Everything else is support.** The helpers in `rl/tools/` and the website in
`site/` exist to make the agent's results visible. They read what training
produces and never take part in producing it.

## Layout

```
rl/
  agent/           REINFORCE, policy network, training loop. Qasim writes this.
  tools/           Logging, weight export, run sync. Support code.
  runs/            Output, one folder per run, committed so the site can read it.
    <run-name>/
      config.json    Hyperparameters and environment name.
      metrics.jsonl  One JSON object per episode.
      policy.json    Exported weights, written at the end of a run.
      notes.md       Optional freeform notes.
site/              Next.js app, deployed to Vercel as a static export.
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
| `python3 rl/tools/sync.py` | Copies runs into the site and rebuilds `index.json`. |
| `python3 rl/tools/make_synthetic_run.py` | Regenerates the fake example run. |
| `npm run dev` (in `site/`) | Development server on port 3000. |
| `npm run sync` (in `site/`) | The sync script, also run automatically before a build. |
| `npm run build` (in `site/`) | Static export into `site/out/`. |
| `npm run typecheck` and `npm run lint` (in `site/`) | What continuous integration checks. |

Syncing is deterministic. The same runs always produce the same `index.json`, so
running it does not leave a spurious diff behind.

## The synthetic run

`rl/runs/_synthetic-example/` is fake data, thirty episodes of invented rewards
and losses, so the charts and the run table could be built before real training
existed. Its config sets `"synthetic": true` and the site labels it wherever it
appears. It has no `policy.json`, so the demo page falls back to the random
agent. Delete it once there are real runs.

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

Vercel, with the project root directory set to `site`. `npm run build` triggers
`prebuild`, which runs the sync script. If Python is unavailable in the build
environment the sync is skipped with a warning and the build uses the copy of
the run data already committed in `site/public/data`, so a deploy never fails
over it.
