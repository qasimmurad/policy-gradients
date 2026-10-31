---
title: Project setup
date: 2026-09-26
---

Repository, tooling and website scaffolded before any training code.

The helper tooling in `rl/tools` is in place: `RunLogger` writes one folder per
run with `config.json` and a `metrics.jsonl` line per episode, `export_policy`
writes the trained weights to `policy.json`, and `sync.py` copies runs into the
site and builds the index the pages read. A unit test exports a small network
and checks that replaying its JSON by hand gives the same action probabilities
as PyTorch, which is what lets the browser demo be trusted.

The run shown at this point, `_synthetic-example`, was fake. It existed so the
charts and the run table could be built and reviewed before any real run had
happened, and it was removed once the random baselines replaced it. It had no
exported policy, so the demo page fell back to the random agent.

Next up is the REINFORCE implementation itself.
