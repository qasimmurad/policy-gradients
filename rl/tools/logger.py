"""Per-run logging for policy gradient experiments.

`RunLogger` creates one folder per training run under `rl/runs/`, writes the
hyperparameters once to `config.json`, then appends one JSON object per episode
to `metrics.jsonl`. Every line is flushed, so a run can be inspected while it is
still training and nothing is lost if the process is killed.

Standard library only.

    from tools.logger import RunLogger

    logger = RunLogger("cartpole-baseline", {"env": "CartPole-v1", "lr": 0.01})
    for episode in range(n_episodes):
        ...
        logger.log(episode, reward=total_reward, loss=loss.item())
    logger.close()

`RunLogger` also works as a context manager, which closes the file for you:

    with RunLogger("cartpole-baseline", config) as logger:
        ...
"""

from __future__ import annotations

import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping, Optional

# rl/tools/logger.py -> rl/ -> rl/runs
DEFAULT_RUNS_DIR = Path(__file__).resolve().parents[1] / "runs"

CONFIG_FILENAME = "config.json"
METRICS_FILENAME = "metrics.jsonl"


def _utc_now() -> str:
    """Current time as an ISO 8601 string in UTC, for example 2026-09-26T21:04:07Z."""
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _finite(value: Any) -> Optional[float]:
    """Coerce to float, mapping None, NaN and infinities to None.

    Losses can blow up in reinforcement learning, and `NaN` or `Infinity` are not
    valid JSON. Storing null keeps `metrics.jsonl` parseable by the website.
    """
    if value is None:
        return None
    number = float(value)
    if not math.isfinite(number):
        return None
    return number


def _check_run_name(run_name: str) -> str:
    if not run_name or run_name.strip() != run_name:
        raise ValueError("run_name must be a non-empty string with no surrounding whitespace")
    if os.sep in run_name or (os.altsep and os.altsep in run_name) or run_name in {".", ".."}:
        raise ValueError(f"run_name must be a single folder name, got {run_name!r}")
    return run_name


class RunLogger:
    """Writes `config.json` and `metrics.jsonl` for a single training run.

    Args:
        run_name: Folder name for the run, for example "cartpole-baseline".
        config: Hyperparameters and environment name. Written verbatim to
            `config.json`, with `run_name` and `created_at` filled in if absent.
        runs_dir: Where run folders live. Defaults to `rl/runs`.
        resume: If False (the default) an existing `metrics.jsonl` is truncated,
            so rerunning a run name does not interleave two runs in one file.
    """

    def __init__(
        self,
        run_name: str,
        config: Mapping[str, Any],
        runs_dir: Optional[os.PathLike | str] = None,
        resume: bool = False,
    ) -> None:
        self.run_name = _check_run_name(run_name)
        self.runs_dir = Path(runs_dir) if runs_dir is not None else DEFAULT_RUNS_DIR
        self.path = self.runs_dir / self.run_name
        self.path.mkdir(parents=True, exist_ok=True)

        stored_config = {"run_name": self.run_name, "created_at": _utc_now()}
        stored_config.update(dict(config))
        self.config = stored_config
        self._write_config()

        self.episodes_logged = 0
        self._closed = False
        self._metrics_file = open(
            self.path / METRICS_FILENAME, "a" if resume else "w", encoding="utf-8"
        )

    def _write_config(self) -> None:
        target = self.path / CONFIG_FILENAME
        with open(target, "w", encoding="utf-8") as handle:
            json.dump(self.config, handle, indent=2, sort_keys=False)
            handle.write("\n")

    def log(self, episode: int, reward: float, loss: Optional[float] = None, **extra: Any) -> None:
        """Append one episode to `metrics.jsonl`.

        Args:
            episode: Episode index, as used by the training loop.
            reward: Total undiscounted reward for the episode.
            loss: Policy loss for the update, or None if there was not one.
            **extra: Any additional scalars to record alongside the required
                fields, for example `entropy=0.61` or `kl=0.02`.
        """
        if self._closed:
            raise RuntimeError("RunLogger is closed, create a new one to keep logging")

        record: dict[str, Any] = {
            "episode": int(episode),
            "reward": _finite(reward),
            "loss": _finite(loss),
            "timestamp": _utc_now(),
        }
        for key, value in extra.items():
            record[key] = _finite(value) if isinstance(value, (int, float)) else value

        self._metrics_file.write(json.dumps(record, allow_nan=False) + "\n")
        self._metrics_file.flush()
        self.episodes_logged += 1

    def write_notes(self, text: str) -> Path:
        """Write `notes.md` for this run. Freeform, optional."""
        target = self.path / "notes.md"
        with open(target, "w", encoding="utf-8") as handle:
            handle.write(text.rstrip() + "\n")
        return target

    def close(self) -> None:
        if not self._closed:
            self._metrics_file.close()
            self._closed = True

    def __enter__(self) -> "RunLogger":
        return self

    def __exit__(self, *exc_info: Any) -> None:
        self.close()

    def __repr__(self) -> str:
        return f"RunLogger(run_name={self.run_name!r}, episodes_logged={self.episodes_logged})"
