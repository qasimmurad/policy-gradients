"""REINFORCE, written by hand.

REINFORCE is the simplest policy gradient method: play a whole episode, work out
the return that followed each action, then raise or lower the log probability of
that action in proportion to its return. It needs no value function and no
replay buffer, which makes it the right place to start and the wrong place to
stop.

Depends on torch, Gymnasium for CartPole, the gridworld in rl/envs, and RunLogger
and export_policy from rl/tools.

Qasim writes the learning code here. Every body marked NotImplementedError is
his: the forward pass, action sampling, returns, the loss and the training loop.
Argument parsing is the only thing here that is not his. Environment
construction and the random baseline deliberately live elsewhere, in rl/envs and
rl/tools, so that everything in this directory is code he wrote.
"""

from __future__ import annotations

import argparse
import random
import sys
from pathlib import Path
from typing import Any

import numpy as np
import torch
from torch import nn

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from envs import make_env  # noqa: E402
from tools.baseline import run_random_baseline  # noqa: E402
from tools.export import export_policy  # noqa: E402
from tools.logger import RunLogger  # noqa: E402


class Policy(nn.Module):
    """Two layer network mapping an observation to a distribution over actions.

    Plain nn.Linear on purpose. tools/export.py walks the linear layers in order
    and writes their weights to policy.json, and lib/policy.ts in the site
    replays that same chain in the browser, so anything fancier would not
    survive the trip.
    """

    def __init__(self, obs_dim: int, n_actions: int, hidden: int = 64) -> None:
        super().__init__()
        self.fc1 = nn.Linear(obs_dim, hidden)
        self.fc2 = nn.Linear(hidden, n_actions)

    def forward(self, obs: torch.Tensor) -> torch.Tensor:
        """Action probabilities for an observation. ReLU between the layers, softmax out."""
        raise NotImplementedError("Qasim writes this")


def select_action(policy: Policy, obs: np.ndarray) -> tuple[int, torch.Tensor]:
    """Sample an action from the policy and return it with its log probability.

    The log probability must stay attached to the graph, because the loss
    differentiates through it after the episode ends.
    """
    raise NotImplementedError("Qasim writes this")


def discounted_returns(rewards: list[float], gamma: float) -> list[float]:
    """Return-to-go for each step, meaning the discounted sum of rewards from there on.

    Cheapest built backwards, carrying one running total.
    """
    raise NotImplementedError("Qasim writes this")


def run_episode(
    env: Any, policy: Policy, max_steps: int
) -> tuple[list[torch.Tensor], list[float], dict[str, float]]:
    """Play one episode, collecting what the update and the log both need.

    The third value is the per episode metrics. It should carry `episode_length`
    always, and `true_reward` and `proxy_reward` whenever the environment
    reports them in its step info, which the gridworld always does and CartPole
    never does. sync.py looks for those two columns to decide whether the runs
    page draws proxy against truth, so the names matter.
    """
    raise NotImplementedError("Qasim writes this")


def reinforce_loss(log_probs: list[torch.Tensor], returns: list[float]) -> torch.Tensor:
    """The REINFORCE objective, shaped as something an optimiser can minimise.

    The gradient we want ascends log pi(a|s) weighted by the return that
    followed it, so what gets handed to the optimiser is its negative: minus the
    sum of log probability times return. An action followed by a high return
    becomes more likely, one followed by a low return becomes less likely.

    There is no baseline here yet. Subtracting one, usually the mean return,
    leaves the gradient unbiased while cutting its variance, and is the obvious
    next thing to add.
    """
    raise NotImplementedError("Qasim writes this")


def train(args: argparse.Namespace) -> None:
    """Train a policy and record the run.

    Builds the environment and policy, plays `args.episodes` episodes updating
    after each, logs every episode through RunLogger, and calls export_policy at
    the end so the browser demo can replay the trained weights.
    """
    raise NotImplementedError("Qasim writes this")


def main() -> None:
    """Parse arguments and dispatch to training or the random baseline."""
    parser = argparse.ArgumentParser(description="Train a REINFORCE agent, or log a random baseline.")
    parser.add_argument("--env", choices=["cartpole", "gridworld"], required=True)
    parser.add_argument(
        "--reward",
        choices=["true", "proxy"],
        default=None,
        help="gridworld only, which reward the agent is paid",
    )
    parser.add_argument(
        "--agent",
        choices=["reinforce", "random"],
        default="reinforce",
        help="random acts uniformly and does not learn, for a baseline run",
    )
    parser.add_argument("--episodes", type=int, default=500)
    parser.add_argument("--lr", type=float, default=0.01)
    parser.add_argument("--gamma", type=float, default=0.99)
    parser.add_argument("--hidden", type=int, default=64)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--run-name", default=None)
    args = parser.parse_args()

    if args.env == "cartpole" and args.reward is not None:
        parser.error("--reward applies to the gridworld only")
    args.reward = args.reward or "true"

    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)

    env = make_env(args.env, args.reward)
    if args.agent == "random":
        run_random_baseline(env, args.episodes, args.env, args.run_name)
    else:
        train(args)


if __name__ == "__main__":
    main()
