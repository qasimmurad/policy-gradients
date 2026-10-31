---
title: Infrastructure and tooling
date: 2026-09-26
---

Repository, tooling and site scaffolded before any training code.

- `rl/tools/logger.py`: `RunLogger` creates `rl/runs/<name>/`, writes
  `config.json`, appends one flushed JSON line per episode to `metrics.jsonl`.
  Standard library only. Non-finite losses are written as null.
- `rl/tools/export.py`: `export_policy` walks the model's linear layers in order
  and writes `policy.json` at 6 dp, shape [out_features, in_features].
- `rl/tools/sync.py`: copies `rl/runs` into `site/public/data/` and builds
  `index.json`. Deterministic, so a sync leaves no spurious diff.
- Export parity test: exports a small network, replays the JSON forward pass by
  hand in Python, asserts it matches PyTorch to 5 dp. This is what the browser
  demo depends on, though the browser code itself is not under test.
- `_synthetic-example`: 30 episodes of invented data, added to exercise the
  charts, the run table and JSONL indexing before any model had run. No exported
  policy, so the demo page fell back to a random agent. Removed 2026-10-31.
- Site: Next.js static export, five pages, deployed to GitHub Pages.
