---
title: Gridworld, and the first real runs
date: 2026-10-31
---

Phase 2 has an environment, and the repository finally has data from something
that actually ran.

The gridworld is 5 by 5 with the goal in the bottom right corner. Under the true
reward the agent gets +1 for reaching the goal and nothing otherwise. Under the
proxy reward it gets +0.1 for a step towards the goal and loses only 0.01 for a
step away. That asymmetry is the entire point. An agent standing beside the goal
can step off and back forever at +0.09 every two steps, and across the 50 step
cap that loop pays about 2.58, while walking straight in and finishing pays 1.80
and ends the episode immediately. The best thing a proxy agent can do is loiter
and never arrive.

An earlier version of the proxy charged 0.1 for a step away rather than 0.01.
That version cannot be farmed at all. The penalty exactly cancels the bonus, so
a round trip is worth zero and the total along any path depends only on where it
started and where it stopped, never on the route. It was caught by simulating
the oscillation before the environment was written. The tests now assert that
dithering outpays finishing, so if that property is ever lost a test fails
rather than the result quietly going missing.

`_synthetic-example` has been deleted, along with the script that generated it.
In its place are two random baselines, which are measured rather than invented.
Random scores a mean reward of 22.2 on CartPole. On the gridworld it reaches the
goal in 97 of 300 episodes, a mean true reward of 0.32, while collecting a mean
proxy reward of 2.16. That second pair is the bar to clear. The result to look
for from a trained proxy agent is its proxy reward climbing above 2.16 while its
true reward falls towards zero.

`rl/agent/reinforce.py` has signatures, type hints and docstrings, with every
learning body left as `NotImplementedError`. Nothing trains until those are
written.

<!-- Qasim: this entry records only what was built and what was measured.
Anything about why you picked these hyperparameters, what you expected to see,
or what surprised you once the training actually ran is yours to write. Send me
notes and I will fold them in rather than guessing. -->
