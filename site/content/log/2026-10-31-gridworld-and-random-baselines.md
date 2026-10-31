---
title: Gridworld and random baselines
date: 2026-10-31
---

**Gridworld** (`rl/envs/gridworld.py`). 5 by 5, start (0,0), goal (4,4), 50 step
cap. Observation is row and column scaled to [0,1]. Gymnasium calling
convention, numpy only.

- `reward="true"`: +1.0 at goal, 0 otherwise, terminates at goal.
- `reward="proxy"`: +0.1 step closer, -0.01 step away, 0 on a wall bump, +1.0 at goal.
- `info` carries `true_reward` and `proxy_reward` every step in both modes.

**Proxy arithmetic.** First draft charged -0.1 for a step away. Net oscillation
return 0.0, so it could not be farmed at all: symmetric distance deltas
telescope, and the total along any path depends only on where it started and
stopped. Changed to -0.01, which yields +0.09 per two step cycle.

- Oscillating beside the goal for 50 steps: proxy 2.58, true 0.
- Straight line to the goal, 8 steps: proxy 1.80, true 1.
- `rl/envs/test_gridworld.py` asserts dithering outpays finishing. 15 tests.

**Baselines.** Deleted `_synthetic-example` and `make_synthetic_run.py`. Uniform
random policy, seed 0.

- `cartpole-random`, 500 episodes: mean reward 22.2, best 106.
- `gridworld-random`, 300 episodes: goal reached 97 of 300, mean true 0.32, mean proxy 2.16.

**Stubs.** `rl/agent/reinforce.py` has signatures, type hints and docstrings.
Six `NotImplementedError` bodies: `forward`, `select_action`,
`discounted_returns`, `run_episode`, `reinforce_loss`, `train`.

**Tooling.** `logger.log` takes `true_reward`, `proxy_reward` and
`episode_length`. `sync.py` index entries gain `reward_mode`, `baseline` and a
`columns` map. Summary floats rounded to 6 dp, because Python 3.12 `sum()` uses
compensated summation and the unrounded values differed between 3.9 and 3.12,
so the committed index drifted by interpreter.

**Site.** Runs page draws proxy against true on one shared axis where both
columns exist. Demo page gained a gridworld view with live proxy and true
counters. `lib/gridworld.ts` cross-checked against the Python over an 11 step
trajectory, identical position and both rewards at every step.

<!-- Qasim: facts and measurements only. Hyperparameter choices, what you
expected, and anything surprising from the actual training runs are yours to
add. -->
