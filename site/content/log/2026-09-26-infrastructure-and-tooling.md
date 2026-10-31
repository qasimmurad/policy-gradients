---
title: Tooling before any training code
date: 2026-09-26
---

Everything here was built before there was a model to train. That ordering is on purpose. Logging, export, syncing and the site are the parts that decide whether you can believe anything you see later, and they're far easier to get right while nothing is riding on them.

`rl/tools/logger.py` holds `RunLogger`, which creates `rl/runs/<name>/`, writes `config.json`, and appends one flushed JSON line per episode to `metrics.jsonl`. Standard library only, because a logger that breaks on a version bump takes your run history with it. Flushed per line, so an interrupted run is still readable up to the point it died. Non-finite losses go in as `null`, since NaN isn't valid JSON and a loss going NaN is a perfectly normal Tuesday in reinforcement learning. You want that recorded as a datum, not as a crash in your logging layer.

`rl/tools/export.py` has `export_policy`, which walks the model's linear layers in order and writes `policy.json` at 6 decimal places, shape `[out_features, in_features]`. `rl/tools/sync.py` copies `rl/runs` into `site/public/data/` and builds `index.json`, deterministically, so running it twice leaves no spurious diff. That determinism matters more than it sounds like it should. The artifacts are committed, and without it every sync is noise in the history until you stop reading your own diffs.

There's an export parity test, and it's worth being precise about what it covers. It exports a small network, replays the JSON forward pass by hand in Python, and asserts agreement with PyTorch to 5 decimal places. That catches a transposed weight matrix, a dropped bias, a layer visited out of order. It does not exercise the browser. Nothing automated touches `lib/policy.ts`. The TypeScript that actually runs in the demo is unverified, so the parity test buys you confidence in the format and none in the consumer. Better to say that out loud than let a green suite imply more coverage than it has.

`_synthetic-example` was 30 episodes of invented data, added so the charts, the run table and the JSONL indexing could be exercised before any model had produced a single episode. It had no exported policy, so the demo page fell back to a random agent, which is a path worth having tested anyway. It came out on 2026-10-31 once real runs existed. Fake data is a reasonable scaffold and a terrible permanent resident, so give it an obvious name and a removal date.

The site is a Next.js static export, five pages, deployed to GitHub Pages.
