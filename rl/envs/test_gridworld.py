"""Tests for the gridworld, including the reward hack it is built to show.

    python3 -m unittest discover -s rl/envs -p "test_*.py"

The oscillation test is the important one. If it ever starts failing, the proxy
reward has stopped being farmable and the whole Phase 2 story goes with it.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from envs.gridworld import (  # noqa: E402
    DOWN,
    GOAL,
    LEFT,
    MAX_STEPS,
    RIGHT,
    UP,
    GridWorld,
    manhattan_to_goal,
)

STRAIGHT_TO_GOAL = [DOWN] * 4 + [RIGHT] * 4


class TestTrueReward(unittest.TestCase):
    def test_walking_straight_to_the_goal_pays_exactly_one(self):
        env = GridWorld(reward="true")
        env.reset()

        total = 0.0
        for action in STRAIGHT_TO_GOAL:
            _, reward, terminated, truncated, _ = env.step(action)
            total += reward

        self.assertEqual(total, 1.0)
        self.assertTrue(terminated)
        self.assertFalse(truncated)
        self.assertEqual(env.position, GOAL)

    def test_every_step_before_the_goal_pays_nothing(self):
        env = GridWorld(reward="true")
        env.reset()
        for action in STRAIGHT_TO_GOAL[:-1]:
            _, reward, terminated, _, _ = env.step(action)
            self.assertEqual(reward, 0.0)
            self.assertFalse(terminated)


class TestProxyReward(unittest.TestCase):
    def test_oscillating_next_to_the_goal_farms_the_proxy(self):
        env = GridWorld(reward="proxy")
        env.reset()
        # Drop the agent beside the goal rather than walking it there, so the
        # total below is only what the oscillation itself earned.
        env.position = (3, 4)

        cycles = 10
        total = 0.0
        for _ in range(cycles):
            for action in (UP, DOWN):
                _, reward, terminated, truncated, _ = env.step(action)
                total += reward
                self.assertFalse(terminated, "the agent never stepped on the goal")

        # +0.1 coming back towards the goal, -0.01 going away, every two steps.
        self.assertAlmostEqual(total, 0.09 * cycles, places=6)
        self.assertGreater(total, 0.0)
        self.assertEqual(env.position, (3, 4))

    def test_one_cycle_is_worth_nine_hundredths(self):
        env = GridWorld(reward="proxy")
        env.reset()
        env.position = (3, 4)

        _, away, _, _, _ = env.step(UP)
        _, back, _, _, _ = env.step(DOWN)

        self.assertAlmostEqual(away, -0.01, places=6)
        self.assertAlmostEqual(back, 0.1, places=6)
        self.assertAlmostEqual(away + back, 0.09, places=6)

    def test_dithering_outpays_finishing_over_a_full_episode(self):
        """The hack has to actually beat the honest policy, or nothing learns it."""
        honest = GridWorld(reward="proxy")
        honest.reset()
        honest_total = sum(honest.step(action)[1] for action in STRAIGHT_TO_GOAL)

        hacker = GridWorld(reward="proxy")
        hacker.reset()
        hacker_total = 0.0
        for action in [DOWN] * 3 + [RIGHT] * 4:
            hacker_total += hacker.step(action)[1]
        while hacker.steps < MAX_STEPS:
            hacker_total += hacker.step(UP if hacker.position == (3, 4) else DOWN)[1]

        self.assertGreater(hacker_total, honest_total)
        self.assertNotEqual(hacker.position, GOAL)

    def test_bumping_a_wall_is_free(self):
        env = GridWorld(reward="proxy")
        env.reset()
        _, reward, _, _, _ = env.step(UP)
        self.assertEqual(reward, 0.0)
        self.assertEqual(env.position, (0, 0))


class TestSharedBehaviour(unittest.TestCase):
    def test_the_goal_terminates_in_both_modes(self):
        for mode in ("true", "proxy"):
            with self.subTest(reward=mode):
                env = GridWorld(reward=mode)
                env.reset()
                for action in STRAIGHT_TO_GOAL:
                    _, _, terminated, _, _ = env.step(action)
                self.assertTrue(terminated)
                self.assertEqual(env.position, GOAL)

    def test_info_reports_both_rewards_whichever_mode_is_active(self):
        for mode in ("true", "proxy"):
            with self.subTest(reward=mode):
                env = GridWorld(reward=mode)
                env.reset()
                _, _, _, _, info = env.step(DOWN)
                self.assertIn("true_reward", info)
                self.assertIn("proxy_reward", info)
                self.assertEqual(info["true_reward"], 0.0)
                self.assertAlmostEqual(info["proxy_reward"], 0.1, places=6)

    def test_reaching_the_goal_reports_both_bonuses(self):
        env = GridWorld(reward="true")
        env.reset()
        for action in STRAIGHT_TO_GOAL[:-1]:
            env.step(action)
        _, _, _, _, info = env.step(STRAIGHT_TO_GOAL[-1])
        self.assertEqual(info["true_reward"], 1.0)
        # The last step also closed the distance, so the proxy pays both parts.
        self.assertAlmostEqual(info["proxy_reward"], 1.1, places=6)

    def test_an_episode_that_never_finishes_is_truncated(self):
        env = GridWorld(reward="proxy")
        env.reset()
        for _ in range(MAX_STEPS):
            _, _, terminated, truncated, _ = env.step(UP)
        self.assertFalse(terminated)
        self.assertTrue(truncated)
        self.assertEqual(env.steps, MAX_STEPS)

    def test_observation_is_the_position_scaled_to_the_unit_square(self):
        env = GridWorld()
        observation, _ = env.reset()
        self.assertEqual(observation.shape, (2,))
        self.assertEqual(list(observation), [0.0, 0.0])

        env.position = GOAL
        self.assertEqual(list(env._observation()), [1.0, 1.0])

    def test_spaces_match_what_the_training_loop_reads(self):
        env = GridWorld()
        self.assertEqual(env.action_space.n, 4)
        self.assertEqual(env.observation_space.shape, (2,))

    def test_rejects_an_unknown_reward_mode(self):
        with self.assertRaises(ValueError):
            GridWorld(reward="shaped")

    def test_rejects_an_unknown_action(self):
        env = GridWorld()
        env.reset()
        with self.assertRaises(ValueError):
            env.step(9)

    def test_manhattan_distance(self):
        self.assertEqual(manhattan_to_goal((0, 0)), 8)
        self.assertEqual(manhattan_to_goal(GOAL), 0)
        self.assertEqual(manhattan_to_goal((3, 4)), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
