"""Tests for the helper tooling. Standard library unittest, no pytest needed.

    python3 -m unittest discover -s rl/tools -v

The torch test is skipped automatically if torch is not installed, so the same
command works in continuous integration where only the standard library is
available.
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tools.logger import RunLogger  # noqa: E402
from tools.sync import sync  # noqa: E402

try:
    import torch
    from torch import nn

    HAS_TORCH = True
except ImportError:  # pragma: no cover
    HAS_TORCH = False


def fake_run(runs_dir: Path, name: str, episodes: int, **config_extra) -> None:
    """A run with a rising reward curve, used to exercise the tooling."""
    config = {"env": "CartPole-v1", "algorithm": "REINFORCE", "learning_rate": 0.01}
    config.update(config_extra)
    with RunLogger(name, config, runs_dir=runs_dir) as logger:
        for episode in range(episodes):
            logger.log(episode, reward=float(10 + episode), loss=1.0 / (episode + 1))


class TestRunLogger(unittest.TestCase):
    def test_creates_config_and_metrics(self):
        with tempfile.TemporaryDirectory() as tmp:
            runs_dir = Path(tmp)
            fake_run(runs_dir, "a-run", 30)

            run_dir = runs_dir / "a-run"
            config = json.loads((run_dir / "config.json").read_text())
            self.assertEqual(config["env"], "CartPole-v1")
            self.assertEqual(config["run_name"], "a-run")
            self.assertIn("created_at", config)

            lines = (run_dir / "metrics.jsonl").read_text().strip().splitlines()
            self.assertEqual(len(lines), 30)
            first = json.loads(lines[0])
            self.assertEqual(
                sorted(first.keys()), ["episode", "loss", "reward", "timestamp"]
            )
            self.assertEqual(first["episode"], 0)
            self.assertEqual(first["reward"], 10.0)

    def test_non_finite_values_become_null(self):
        with tempfile.TemporaryDirectory() as tmp:
            with RunLogger("nan-run", {"env": "CartPole-v1"}, runs_dir=Path(tmp)) as logger:
                logger.log(0, reward=12.0, loss=float("nan"))
                logger.log(1, reward=13.0, loss=float("inf"))
            lines = (Path(tmp) / "nan-run" / "metrics.jsonl").read_text().strip().splitlines()
            self.assertIsNone(json.loads(lines[0])["loss"])
            self.assertIsNone(json.loads(lines[1])["loss"])

    def test_extra_scalars_are_kept(self):
        with tempfile.TemporaryDirectory() as tmp:
            with RunLogger("kl-run", {"env": "CartPole-v1"}, runs_dir=Path(tmp)) as logger:
                logger.log(0, reward=5.0, loss=0.2, kl=0.013)
            record = json.loads((Path(tmp) / "kl-run" / "metrics.jsonl").read_text().strip())
            self.assertAlmostEqual(record["kl"], 0.013)

    def test_records_the_phase_two_metrics(self):
        with tempfile.TemporaryDirectory() as tmp:
            with RunLogger("grid", {"env": "gridworld"}, runs_dir=Path(tmp)) as logger:
                logger.log(
                    0,
                    reward=2.58,
                    loss=0.1,
                    true_reward=0.0,
                    proxy_reward=2.58,
                    episode_length=50,
                )
            record = json.loads((Path(tmp) / "grid" / "metrics.jsonl").read_text().strip())
            self.assertEqual(record["true_reward"], 0.0)
            self.assertAlmostEqual(record["proxy_reward"], 2.58)
            self.assertEqual(record["episode_length"], 50)
            # The required fields are still there and still named the same.
            self.assertEqual(record["episode"], 0)
            self.assertAlmostEqual(record["reward"], 2.58)

    def test_rejects_a_path_as_a_run_name(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                RunLogger("../escape", {"env": "CartPole-v1"}, runs_dir=Path(tmp))


class TestSync(unittest.TestCase):
    def test_index_lists_runs_with_config_and_last_episode(self):
        with tempfile.TemporaryDirectory() as tmp:
            runs_dir = Path(tmp) / "runs"
            data_dir = Path(tmp) / "data"
            fake_run(runs_dir, "short-run", 5)
            fake_run(runs_dir, "long-run", 5000, baseline=True)

            index = sync(runs_dir=runs_dir, data_dir=data_dir, quiet=True)

            self.assertEqual([run["name"] for run in index["runs"]], ["long-run", "short-run"])
            by_name = {run["name"]: run for run in index["runs"]}

            self.assertEqual(by_name["short-run"]["last_episode"], 4)
            self.assertEqual(by_name["short-run"]["summary"]["episodes"], 5)
            self.assertFalse(by_name["short-run"]["baseline"])
            self.assertFalse(by_name["short-run"]["has_policy"])
            self.assertEqual(by_name["short-run"]["config"]["learning_rate"], 0.01)

            self.assertEqual(by_name["long-run"]["last_episode"], 4999)
            self.assertTrue(by_name["long-run"]["baseline"])

            # Files are copied where the site expects them.
            self.assertTrue((data_dir / "runs" / "short-run" / "metrics.jsonl").exists())
            self.assertTrue((data_dir / "index.json").exists())

    def test_peak_moving_average_handles_a_five_episode_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            runs_dir = Path(tmp) / "runs"
            fake_run(runs_dir, "tiny", 5)
            index = sync(runs_dir=runs_dir, data_dir=Path(tmp) / "data", quiet=True)
            summary = index["runs"][0]["summary"]
            # Rewards are 10 to 14, fewer than the window of 20, so the peak
            # trailing average is the mean of all five.
            self.assertAlmostEqual(summary["peak_moving_average"], 12.0)
            self.assertAlmostEqual(summary["mean_last_50"], 12.0)
            self.assertEqual(summary["best_reward"], 14.0)

    def test_deleted_runs_disappear_from_the_site(self):
        with tempfile.TemporaryDirectory() as tmp:
            runs_dir = Path(tmp) / "runs"
            data_dir = Path(tmp) / "data"
            fake_run(runs_dir, "keep", 3)
            fake_run(runs_dir, "remove", 3)
            sync(runs_dir=runs_dir, data_dir=data_dir, quiet=True)
            self.assertTrue((data_dir / "runs" / "remove").exists())

            import shutil

            shutil.rmtree(runs_dir / "remove")
            index = sync(runs_dir=runs_dir, data_dir=data_dir, quiet=True)
            self.assertFalse((data_dir / "runs" / "remove").exists())
            self.assertEqual([run["name"] for run in index["runs"]], ["keep"])

    def test_a_truncated_final_line_is_skipped(self):
        with tempfile.TemporaryDirectory() as tmp:
            runs_dir = Path(tmp) / "runs"
            fake_run(runs_dir, "crashed", 4)
            with open(runs_dir / "crashed" / "metrics.jsonl", "a", encoding="utf-8") as handle:
                handle.write('{"episode": 4, "rewa')
            index = sync(runs_dir=runs_dir, data_dir=Path(tmp) / "data", quiet=True)
            self.assertEqual(index["runs"][0]["summary"]["episodes"], 4)


class TestSyncRewardColumns(unittest.TestCase):
    """What the site needs in order to pick a chart."""

    def _gridworld_run(self, runs_dir: Path, name: str, mode: str) -> None:
        config = {"env": "gridworld", "reward_mode": mode, "algorithm": "REINFORCE"}
        with RunLogger(name, config, runs_dir=runs_dir) as logger:
            for episode in range(4):
                logger.log(
                    episode,
                    reward=0.5 * episode,
                    loss=0.1,
                    true_reward=0.0,
                    proxy_reward=0.5 * episode,
                    episode_length=50,
                )

    def test_a_gridworld_run_declares_both_reward_columns(self):
        with tempfile.TemporaryDirectory() as tmp:
            runs_dir = Path(tmp) / "runs"
            self._gridworld_run(runs_dir, "grid-proxy", "proxy")
            entry = sync(runs_dir=runs_dir, data_dir=Path(tmp) / "data", quiet=True)["runs"][0]

            self.assertEqual(entry["reward_mode"], "proxy")
            self.assertTrue(entry["columns"]["true_reward"])
            self.assertTrue(entry["columns"]["proxy_reward"])
            self.assertEqual(entry["summary"]["mean_true_last_50"], 0.0)
            self.assertAlmostEqual(entry["summary"]["mean_proxy_last_50"], 0.75)

    def test_a_cartpole_run_declares_neither(self):
        with tempfile.TemporaryDirectory() as tmp:
            runs_dir = Path(tmp) / "runs"
            fake_run(runs_dir, "cartpole-v1", 4)
            entry = sync(runs_dir=runs_dir, data_dir=Path(tmp) / "data", quiet=True)["runs"][0]

            self.assertIsNone(entry["reward_mode"])
            self.assertFalse(entry["columns"]["true_reward"])
            self.assertFalse(entry["columns"]["proxy_reward"])
            self.assertIsNone(entry["summary"]["mean_true_last_50"])

    def test_a_baseline_is_flagged_so_the_home_page_can_skip_it(self):
        with tempfile.TemporaryDirectory() as tmp:
            runs_dir = Path(tmp) / "runs"
            fake_run(runs_dir, "cartpole-random", 4, baseline=True, algorithm="random")
            fake_run(runs_dir, "cartpole-v1", 4)
            by_name = {
                run["name"]: run
                for run in sync(runs_dir=runs_dir, data_dir=Path(tmp) / "data", quiet=True)["runs"]
            }
            self.assertTrue(by_name["cartpole-random"]["baseline"])
            self.assertFalse(by_name["cartpole-v1"]["baseline"])


@unittest.skipUnless(HAS_TORCH, "torch is not installed")
class TestExportPolicy(unittest.TestCase):
    def test_schema_matches_what_the_browser_expects(self):
        from tools.export import export_policy

        with tempfile.TemporaryDirectory() as tmp:
            runs_dir = Path(tmp)
            fake_run(runs_dir, "exported", 3)
            model = nn.Sequential(nn.Linear(4, 16), nn.ReLU(), nn.Linear(16, 2))
            path = export_policy(model, "exported", runs_dir=runs_dir)

            policy = json.loads(path.read_text())
            self.assertEqual(list(policy.keys()), ["env", "activation", "layers", "output"])
            self.assertEqual(policy["env"], "CartPole-v1")
            self.assertEqual(policy["activation"], "relu")
            self.assertEqual(policy["output"], "softmax")
            self.assertEqual(len(policy["layers"]), 2)

            first, second = policy["layers"]
            # Row major, shape [out_features, in_features], matching torch.
            self.assertEqual(len(first["weight"]), 16)
            self.assertEqual(len(first["weight"][0]), 4)
            self.assertEqual(len(first["bias"]), 16)
            self.assertEqual(len(second["weight"]), 2)
            self.assertEqual(len(second["weight"][0]), 16)

            # Six decimals, so the file stays small.
            self.assertEqual(first["weight"][0][0], round(first["weight"][0][0], 6))

    def test_exported_weights_reproduce_the_torch_forward_pass(self):
        from tools.export import export_policy

        with tempfile.TemporaryDirectory() as tmp:
            model = nn.Sequential(nn.Linear(4, 16), nn.ReLU(), nn.Linear(16, 2))
            path = export_policy(model, "check", runs_dir=Path(tmp), decimals=12)
            policy = json.loads(path.read_text())

            observation = [0.03, -0.12, 0.04, 0.31]

            # The same forward pass the browser runs, written out by hand here.
            activations = observation
            for index, layer in enumerate(policy["layers"]):
                outputs = [
                    sum(w * a for w, a in zip(row, activations)) + bias
                    for row, bias in zip(layer["weight"], layer["bias"])
                ]
                if index < len(policy["layers"]) - 1:
                    outputs = [max(0.0, value) for value in outputs]
                activations = outputs
            largest = max(activations)
            exponentials = [pow(2.718281828459045, value - largest) for value in activations]
            total = sum(exponentials)
            from_json = [value / total for value in exponentials]

            with torch.no_grad():
                from_torch = torch.softmax(
                    model(torch.tensor([observation], dtype=torch.float32)), dim=-1
                )[0].tolist()

            for a, b in zip(from_json, from_torch):
                self.assertAlmostEqual(a, b, places=5)

    def test_model_with_no_linear_layers_is_rejected(self):
        from tools.export import export_policy

        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                export_policy(nn.Sequential(nn.ReLU()), "empty", runs_dir=Path(tmp))


if __name__ == "__main__":
    unittest.main(verbosity=2)
