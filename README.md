# Policy gradients from scratch

REINFORCE written from scratch in PyTorch for my deep learning class. It learns
CartPole first, and then there is a small gridworld I built with a deliberately
broken reward to see whether the agent would farm it instead of solving the
task. It did.

Live demo, charts and the experiment log:
**https://qasimmurad.github.io/policy-gradients/**

## Running it

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python rl/agent/reinforce.py --env cartpole --episodes 500 --run-name cartpole-v1
python rl/agent/reinforce.py --env gridworld --reward true  --episodes 300 --run-name grid-true
python rl/agent/reinforce.py --env gridworld --reward proxy --episodes 300 --run-name grid-proxy

python rl/tools/sync.py
```

Add `--agent random` to get the random baselines. `sync.py` copies the runs into
the site, then `cd site && npm run dev` serves it on port 3000.

## What comes out

Means over the last fifty episodes, timed on an M3 Pro.

| Run | Result | Time |
| --- | --- | --- |
| `cartpole-random` | Mean 22.2 over 500 episodes, best 106 | under a second |
| `gridworld-random` | Goal in 97 of 300 episodes, true 0.32, proxy 2.16 | under a second |
| `cartpole-v1` | About 35 up to a flat 500, which is the cap, by episode 350 | 22 seconds |
| `grid-true` | True 1.00, proxy 1.84, goal in 50 of 50, 12.9 steps on average | 3 seconds |
| `grid-proxy` | True 0.00, proxy 2.18, goal in 0 of 50, hits the 50 step cap every time | 3 seconds |

That last row is the whole point. Same grid, same algorithm, same
hyperparameters, and the only thing that changed is which number the agent gets
handed. The proxy pays 0.1 for a step toward the goal and only takes 0.01 back
for a step away, so going out and back nets about 0.09 and the agent can repeat
that forever. It settles into bouncing between (0,0) and (1,0), two squares from
where it spawns, and never gets within six steps of the goal, while still
out-earning the agent that actually finishes.

## Layout

```
rl/
  agent/reinforce.py   Policy network, action sampling, returns, loss, training loop.
  envs/gridworld.py    5 by 5 grid, with a true reward and a farmable proxy one.
  tools/               Logging, weight export, run sync, random baseline.
  runs/<name>/         config.json, metrics.jsonl, policy.json. Committed, the site reads them.
site/                  Next.js static export.
  public/data/         Runs copied here by sync.py.
  content/log/         Log entries, YYYY-MM-DD-slug.md.
```

A run writes one JSON line per episode as it goes, dumps its weights to
`policy.json` at the end, and `sync.py` turns the whole folder into something the
site can read at build time. The demo page fetches those weights and runs the
forward pass in the browser, so there is no server anywhere.

## Tests

```bash
python3 -m unittest discover -s rl/envs  -p "test_*.py"   # gridworld, including that the proxy is still farmable
python3 -m unittest discover -s rl/tools -p "test_*.py"   # tooling, and that the exported JSON matches torch
```

In `site/`: `npm run typecheck` and `npm run lint` are what CI checks.

## Deploy notes

Every push to `main` builds and publishes to GitHub Pages on its own. Pages
caches for ten minutes, so a green workflow and an unchanged looking page is
usually just the cache.

Pages serves from a sub-path, so the app reads its own prefix from
`NEXT_PUBLIC_BASE_PATH`, which the workflow fills in from
`actions/configure-pages`. `next.config.ts` hands that to Next as `basePath`,
which covers links and assets, and `site/lib/basePath.ts` patches the few places
Next leaves alone (bare `fetch` strings and paths written inside markdown). Run
`npm run preview:pages` to try the sub-path build locally on port 4173, and
remember it leaves a prefixed build in `site/out`, so rebuild before serving that
at a root.

The `postbuild` script writes `out/.nojekyll`, which matters because otherwise
Pages runs everything through Jekyll and throws away `_next/`.

Vercel also works, with the root directory set to `site` and
`NEXT_PUBLIC_BASE_PATH` left unset.
