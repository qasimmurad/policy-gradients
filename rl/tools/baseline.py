"""A random agent, logged like any other run.

This is support code rather than learning code, which is why it lives in tools
and not in rl/agent. It gives every environment a floor to measure a trained
policy against, and it gives the site real data for an environment before any
training has finished.
"""

from __future__ import annotations

import random
from typing import Any

from .logger import RunLogger


def run_random_baseline(
    env: Any, episodes: int, env_name: str, run_name: str | None = None
) -> None:
    """Play episodes of uniformly random actions and log them as a run.

    There is no learning in here at all. The run is marked `baseline: true` in
    its config so the site can label it and the home page does not mistake it
    for a result. Where the environment reports `true_reward` and `proxy_reward`
    per step, both are summed and logged, so one gridworld baseline covers both
    reward modes at once.
    """
    reward_mode = getattr(env, "reward_mode", None)
    config: dict[str, Any] = {
        "env": env_name,
        "algorithm": "random",
        "baseline": True,
        "episodes": episodes,
    }
    if reward_mode is not None:
        config["reward_mode"] = reward_mode

    with RunLogger(run_name or f"{env_name}-random", config) as logger:
        for episode in range(episodes):
            env.reset()
            total, steps = 0.0, 0
            true_total, proxy_total, reports_both = 0.0, 0.0, False

            while True:
                _, reward, terminated, truncated, info = env.step(
                    random.randrange(env.action_space.n)
                )
                total += reward
                steps += 1
                if "true_reward" in info:
                    reports_both = True
                    true_total += info["true_reward"]
                    proxy_total += info["proxy_reward"]
                if terminated or truncated:
                    break

            metrics: dict[str, float] = {"episode_length": steps}
            if reports_both:
                metrics["true_reward"] = true_total
                metrics["proxy_reward"] = proxy_total
            logger.log(episode, reward=total, loss=None, **metrics)
