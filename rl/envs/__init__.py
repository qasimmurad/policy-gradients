"""Environments, and the one function that builds them.

CartPole comes from Gymnasium. The gridworld here is ours, because we needed one
whose reward could be deliberately misspecified.
"""

from __future__ import annotations

from typing import Any

from .gridworld import GridWorld

__all__ = ["GridWorld", "make_env"]


def make_env(name: str, reward: str = "true") -> Any:
    """Build an environment by name.

    Both environments expose `observation_space.shape` and `action_space.n`, so
    a training loop can size its policy the same way whichever one it is handed.
    Gymnasium is imported inside the branch rather than at module scope, so the
    gridworld still runs on a machine without it.
    """
    if name == "cartpole":
        import gymnasium as gym

        return gym.make("CartPole-v1")
    if name == "gridworld":
        return GridWorld(reward=reward)
    raise ValueError(f'unknown environment {name!r}, expected "cartpole" or "gridworld"')
