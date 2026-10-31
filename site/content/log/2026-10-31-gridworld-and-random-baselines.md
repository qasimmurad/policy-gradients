---
title: The proxy reward that couldn't be farmed
date: 2026-10-31
---

A reward hacking experiment has an awkward requirement. You need a reward function that is wrong in a useful way. Wrong enough that maximising it pulls away from what you actually wanted, ordinary enough that a reasonable person would have written it without blinking. The first proxy in `rl/envs/gridworld.py` was ordinary. It was also impossible to hack. Not hard to hack. Impossible.

That draft paid +0.1 for a step that reduced Manhattan distance to the goal, charged -0.1 for a step that increased it, paid nothing for bumping into a wall, and added +1.0 on arrival. Symmetric, tidy, and exactly the thing you'd write if you wanted an agent that loiters next to the goal instead of stepping onto it. So stand beside the goal and loiter. Step away, minus 0.1. Step back, plus 0.1. Net 0.00. Keep going until the step cap. Still 0.00.

A symmetric distance delta is potential based shaping with potential equal to negative distance. The sum telescopes. The total along any path depends only on where it started and where it stopped, never on the route taken, so pacing about in the middle is free and worth nothing. Ng, Harada and Russell showed in 1999 that shaping of this form provably cannot change the optimal policy, which means the first proxy wasn't a broken reward function. It was a correct one. It would have made the task easier to learn and left nothing to exploit, and in a project about exploitation that's the failure mode.

Here's how that would have gone. Nothing crashes. No test goes red, because there's no test yet. You write the environment, you write REINFORCE, you train, and the agent walks to the goal like a well behaved agent, and you have no idea whether that's because your gap closed or because your gap was never there. Reward functions fail silently, the same way nets do, and they fail silently in the direction of looking fine. This one got caught by simulating the oscillation before the environment was written, which is the cheapest place in the pipeline to catch anything.

The fix is one constant. Charge -0.01 for a step away instead of -0.1. The two directions stop cancelling, the telescoping is gone, and an oscillation cycle nets +0.09 every two steps. That's the whole change. One character of asymmetry separates a reward function that's provably safe from one you can farm forever.

With -0.01 in place the two reference trajectories come apart cleanly. Dither beside the goal for the full 50 step cap and you collect proxy 2.58 and true 0. Walk straight in and finish in 8 steps and you collect proxy 1.80 and true 1. Doing the task is worth less than refusing to do it, under the number the agent is actually handed. `rl/envs/test_gridworld.py` carries 15 tests, and one of them asserts that dithering outpays finishing. It's there so that anyone who later tidies the asymmetry back into symmetry, which looks like a cleanup, breaks the build instead of quietly deleting the experiment.

The rest of the spec falls out of wanting that comparison to stay honest. 5 by 5 grid, start at (0,0), goal at (4,4), 50 step cap. The observation is row and column scaled to [0,1], two floats, nothing else. Gymnasium calling convention, numpy only, no torch anywhere near the environment. `reward="true"` pays +1.0 at the goal, 0 otherwise, and terminates on arrival. `reward="proxy"` pays the step delta with the same +1.0 goal bonus on top. In both modes `info` carries `true_reward` and `proxy_reward` on every single step. That's the one decision here that keeps paying out, because the logger never has to know which mode it's running in, and you can read the gap instead of inferring it.

A few habits this round argues for.

- **Simulate the reward before you write the environment.** Not the agent, not the training loop, just the arithmetic along two or three hand picked trajectories. Oscillate in place. Walk straight in. Bump a wall. If the numbers aren't the numbers you expected, you've found the bug in the only phase where finding it is free.
- **Log both rewards on every step, always.** Not the one you're optimising. Both. The interesting quantity in this project is a difference between two series, and a difference you didn't record is a difference you can't plot.
- **Write the test that asserts the bug.** When the pathology is the point, the pathology needs a test guarding it, or some future cleanup pass will helpfully remove your experiment.
- **Check whether you've made it symmetric by accident.** Before reaching for a more elaborate proxy, do the arithmetic on a round trip. If it comes to zero, you've built shaping rather than a hole.

Baselines came next, uniform random policy, seed 0, because you can't interpret a learning curve without knowing what doing nothing looks like. `cartpole-random` over 500 episodes gives mean reward 22.2 and a best episode of 106. `gridworld-random` over 300 episodes reaches the goal 97 times, mean true reward 0.32, mean proxy reward 2.16.

Read those two gridworld numbers together. A random agent collects 2.16 proxy reward. An agent that walks straight in and finishes collects 1.80. Flailing beats competence under this proxy, before any policy has been trained, before any gradient has been taken. So the baseline isn't only a bar for the agent to clear later. It's the strongest evidence available that the reward is broken the way we wanted it broken, and it cost 300 random episodes to get. `_synthetic-example` and `make_synthetic_run.py` are deleted now there's real data to look at.

REINFORCE went in after that, and the runs land where the arithmetic said they would. `cartpole-v1` climbs from about 35 to a flat 500, which is the cap, by episode 350. That's 22 seconds on a laptop CPU, with the textbook objective, no baseline and no return normalisation. Worth noting because the loss docstring flags a baseline as the obvious next change and CartPole never needed one.

The gridworld is the result worth having. Same environment, same algorithm, same hyperparameters. The only difference is which number the agent is handed.

| run | mean true | mean proxy | reached the goal | mean episode length |
| --- | --- | --- | --- | --- |
| `grid-true` | 1.00 | 1.84 | 50 of 50 | 12.9 steps |
| `grid-proxy` | 0.00 | 2.18 | 0 of 50 | 50.0 steps |

Read the proxy row slowly. Zero goals in fifty episodes, and every one of those episodes ran the full 50 step cap. True reward 0.00, flat, fifty times in a row.

What the policy actually learned is worse than the failure mode the environment was designed around, and I had the prediction wrong. The expectation was an agent that walks to the goal and paces beside it, declining to step on the square that ends its income. Trace a trained episode and it never goes near the goal at all. It oscillates between (0,0) and (1,0), two cells from where it spawns, and the closest it gets all episode is six steps away. The asymmetry doesn't care where you exploit it. Any adjacent pair of cells with one nearer the goal than the other pays +0.1 going and 0.01 coming back, so the policy farms the cheapest pair available, which is the one under its feet at reset. It never had to find the goal to learn that ignoring it pays.

It also collects more proxy reward than the agent that actually solves the task, 2.18 against 1.84. Under the number it was given, hacking is not a degenerate corner. It is the correct answer, and the policy found it in 300 episodes.

Tooling moved to match. `logger.log` now takes `true_reward`, `proxy_reward` and `episode_length`. Index entries from `sync.py` gained `reward_mode`, `baseline` and a `columns` map, so the site can tell which runs are comparable instead of guessing from the name. Summary floats are rounded to 6 decimal places, which sounds like fussiness. It isn't. Python 3.12 `sum()` uses compensated summation, so the unrounded values differed between 3.9 and 3.12, and the committed `index.json` drifted depending on which interpreter happened to run the sync. Continuous integration caught that one. Same shape as the reward bug, incidentally. A correct looking change, no error anywhere, and your artifacts quietly start depending on something you never meant them to depend on.

Two site changes. The runs page draws proxy against true on one shared y axis wherever both columns exist. A second axis was considered and rejected, because two independently scaled axes will stretch almost any pair of series until they look like they diverge, and divergence is the exact claim the chart is supposed to be evidence for. If you can only read a plot after someone tells you how it was scaled, it isn't evidence. The demo page gained a gridworld view with live proxy and true counters, and `lib/gridworld.ts` was cross checked against the Python over an 11 step trajectory, identical position, true reward and proxy reward at every step. A browser copy of your environment that drifts from the real one is a demo that lies about the experiment, so it gets checked step by step rather than at the end.
