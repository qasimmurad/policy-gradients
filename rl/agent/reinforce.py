"""REINFORCE.

REINFORCE is the simplest policy gradient method: play a whole episode, work out
the return that followed each action, then raise or lower the log probability of
that action in proportion to its return. It needs no value function and no
replay buffer, which makes it the right place to start and the wrong place to
stop.

Depends on torch, Gymnasium for CartPole, the gridworld in rl/envs, and RunLogger
and export_policy from rl/tools.

Everything here is textbook REINFORCE with no baseline, which is deliberate.
The loss docstring says where a baseline would go and why it is the obvious next
change. Environment construction and the random baseline live elsewhere, in
rl/envs and rl/tools, so this file holds the algorithm and nothing else.
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

# A safety net only. Both environments truncate themselves well before this,
# CartPole at 500 steps and the gridworld at 50.
EPISODE_STEP_CAP = 1000


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
        hidden = torch.relu(self.fc1(obs))
        return torch.softmax(self.fc2(hidden), dim=-1)


def select_action(policy: Policy, obs: np.ndarray) -> tuple[int, torch.Tensor]:
    """Sample an action from the policy and return it with its log probability.

    The log probability must stay attached to the graph, because the loss
    differentiates through it after the episode ends.
    """
    probabilities = policy(torch.as_tensor(obs, dtype=torch.float32))
    distribution = torch.distributions.Categorical(probs=probabilities)
    action = distribution.sample()
    # .item() detaches the action, which is correct. The log probability is the
    # thing that has to keep its graph, so it is returned as a tensor.
    return int(action.item()), distribution.log_prob(action)


def discounted_returns(rewards: list[float], gamma: float) -> list[float]:
    """Return-to-go for each step, meaning the discounted sum of rewards from there on.

    Cheapest built backwards, carrying one running total.
    """
    returns: list[float] = []
    running = 0.0
    for reward in reversed(rewards):
        running = reward + gamma * running
        returns.append(running)
    returns.reverse()
    return returns


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
    obs, _ = env.reset()
    log_probs: list[torch.Tensor] = []
    rewards: list[float] = []
    true_total, proxy_total, reports_both = 0.0, 0.0, False

    for _ in range(max_steps):
        action, log_prob = select_action(policy, obs)
        obs, reward, terminated, truncated, info = env.step(action)
        log_probs.append(log_prob)
        rewards.append(float(reward))

        if "true_reward" in info:
            reports_both = True
            true_total += info["true_reward"]
            proxy_total += info["proxy_reward"]

        if terminated or truncated:
            break

    metrics: dict[str, float] = {"episode_length": float(len(rewards))}
    if reports_both:
        metrics["true_reward"] = true_total
        metrics["proxy_reward"] = proxy_total
    return log_probs, rewards, metrics


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
    weights = torch.as_tensor(returns, dtype=torch.float32)
    return -(torch.stack(log_probs) * weights).sum()


def train(args: argparse.Namespace) -> None:
    """Train a policy and record the run.

    Builds the environment and policy, plays `args.episodes` episodes updating
    after each, logs every episode through RunLogger, and calls export_policy at
    the end so the browser demo can replay the trained weights.
    """
    env = make_env(args.env, args.reward)
    env.reset(seed=args.seed)

    policy = Policy(env.observation_space.shape[0], env.action_space.n, args.hidden)
    optimiser = torch.optim.Adam(policy.parameters(), lr=args.lr)

    run_name = args.run_name or f"{args.env}-reinforce"
    config: dict[str, Any] = {
        "env": "CartPole-v1" if args.env == "cartpole" else args.env,
        "algorithm": "REINFORCE",
        "baseline": False,
        "episodes": args.episodes,
        "learning_rate": args.lr,
        "gamma": args.gamma,
        "hidden_size": args.hidden,
        "optimizer": "Adam",
        "seed": args.seed,
    }
    if args.env == "gridworld":
        config["reward_mode"] = args.reward

    with RunLogger(run_name, config) as logger:
        for episode in range(args.episodes):
            log_probs, rewards, metrics = run_episode(env, policy, EPISODE_STEP_CAP)
            returns = discounted_returns(rewards, args.gamma)
            loss = reinforce_loss(log_probs, returns)

            optimiser.zero_grad()
            loss.backward()
            optimiser.step()

            logger.log(episode, reward=sum(rewards), loss=loss.item(), **metrics)
            if episode % 25 == 0 or episode == args.episodes - 1:
                print(f"episode {episode:>4}  reward {sum(rewards):8.2f}  loss {loss.item():10.3f}")

    export_policy(policy, run_name)
    print(f"wrote rl/runs/{run_name}/policy.json")


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
