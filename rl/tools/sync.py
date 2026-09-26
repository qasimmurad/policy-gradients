"""Copy run data into the website and build its index.

Run this before every site build. `npm run sync` inside `site/` calls it, and
`npm run build` calls it through the `prebuild` hook.

It does two things:

1. Copies `rl/runs/` to `site/public/data/runs/`, keeping only the four files the
   site reads, so a stray checkpoint or video never ends up in the deploy.
2. Writes `site/public/data/index.json` listing every run with its config, its
   last logged episode, and a few summary numbers the site would otherwise have
   to recompute in the browser on every page load.

Standard library only, so continuous integration does not need torch installed.
"""

from __future__ import annotations

import argparse
import json
import math
import shutil
import sys
from pathlib import Path
from typing import Any, Optional

REPO_ROOT = Path(__file__).resolve().parents[2]
RUNS_DIR = REPO_ROOT / "rl" / "runs"
DATA_DIR = REPO_ROOT / "site" / "public" / "data"

# Only these are copied into the site. Anything else in a run folder stays put.
COPIED_FILES = ("config.json", "metrics.jsonl", "policy.json", "notes.md")

MOVING_AVERAGE_WINDOW = 20
RECENT_EPISODES = 50


def _read_config(run_dir: Path) -> dict[str, Any]:
    path = run_dir / "config.json"
    if not path.exists():
        return {}
    try:
        with open(path, encoding="utf-8") as handle:
            config = json.load(handle)
    except (json.JSONDecodeError, OSError) as error:
        print(f"  warning: could not read {path.name}: {error}", file=sys.stderr)
        return {}
    return config if isinstance(config, dict) else {}


def _read_metrics(run_dir: Path) -> list[dict[str, Any]]:
    path = run_dir / "metrics.jsonl"
    if not path.exists():
        return []
    records: list[dict[str, Any]] = []
    with open(path, encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                # A run killed mid-write can leave one partial final line.
                print(
                    f"  warning: skipping unparseable line {line_number} of {path.name}",
                    file=sys.stderr,
                )
                continue
            if isinstance(record, dict):
                records.append(record)
    return records


def _numbers(records: list[dict[str, Any]], key: str) -> list[float]:
    values = []
    for record in records:
        value = record.get(key)
        if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value):
            values.append(float(value))
    return values


def _peak_moving_average(values: list[float], window: int) -> Optional[float]:
    """Highest value of the trailing moving average, the usual "did it learn" number.

    With fewer episodes than the window, the average over everything so far is
    used, so a five episode run still reports something sensible.
    """
    if not values:
        return None
    total = 0.0
    peak = None
    for index, value in enumerate(values):
        total += value
        if index >= window:
            total -= values[index - window]
        count = min(index + 1, window)
        average = total / count
        peak = average if peak is None else max(peak, average)
    return peak


def _summarise(records: list[dict[str, Any]]) -> dict[str, Any]:
    rewards = _numbers(records, "reward")
    losses = _numbers(records, "loss")
    recent = rewards[-RECENT_EPISODES:]
    return {
        "episodes": len(records),
        "best_reward": max(rewards) if rewards else None,
        "final_reward": rewards[-1] if rewards else None,
        "mean_reward": (sum(rewards) / len(rewards)) if rewards else None,
        "mean_last_50": (sum(recent) / len(recent)) if recent else None,
        "peak_moving_average": _peak_moving_average(rewards, MOVING_AVERAGE_WINDOW),
        "moving_average_window": MOVING_AVERAGE_WINDOW,
        "final_loss": losses[-1] if losses else None,
        "has_loss": bool(losses),
    }


def _last_episode(records: list[dict[str, Any]]) -> Optional[int]:
    for record in reversed(records):
        episode = record.get("episode")
        if isinstance(episode, int):
            return episode
    return None


def _last_timestamp(records: list[dict[str, Any]]) -> Optional[str]:
    for record in reversed(records):
        timestamp = record.get("timestamp")
        if isinstance(timestamp, str):
            return timestamp
    return None


def _is_run_dir(path: Path) -> bool:
    return path.is_dir() and not path.name.startswith(".") and (path / "config.json").exists()


def sync(runs_dir: Path = RUNS_DIR, data_dir: Path = DATA_DIR, quiet: bool = False) -> dict[str, Any]:
    """Copy runs into the site and write the index. Returns the index that was written."""

    def say(message: str) -> None:
        if not quiet:
            print(message)

    destination = data_dir / "runs"
    data_dir.mkdir(parents=True, exist_ok=True)
    # Rebuilt from scratch so a run deleted from rl/runs disappears from the site too.
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True)

    if not runs_dir.exists():
        say(f"no runs directory at {runs_dir}, writing an empty index")
        run_dirs: list[Path] = []
    else:
        run_dirs = sorted((path for path in runs_dir.iterdir() if _is_run_dir(path)), key=lambda p: p.name)

    entries = []
    for run_dir in run_dirs:
        config = _read_config(run_dir)
        records = _read_metrics(run_dir)

        target = destination / run_dir.name
        target.mkdir(parents=True, exist_ok=True)
        copied = []
        for filename in COPIED_FILES:
            source = run_dir / filename
            if source.exists():
                shutil.copy2(source, target / filename)
                copied.append(filename)

        entries.append(
            {
                "name": run_dir.name,
                "synthetic": bool(config.get("synthetic", False)),
                "env": config.get("env"),
                "config": config,
                "last_episode": _last_episode(records),
                "updated_at": _last_timestamp(records),
                "has_policy": "policy.json" in copied,
                "has_notes": "notes.md" in copied,
                "summary": _summarise(records),
            }
        )
        say(
            f"  {run_dir.name}: {len(records)} episodes, "
            f"{'policy exported' if 'policy.json' in copied else 'no policy yet'}"
        )

    # No wall-clock stamp here on purpose. Syncing the same runs twice writes
    # a byte identical index, so `npm run sync` never dirties the working tree
    # and continuous integration can check that the committed copy is current.
    index = {
        "moving_average_window": MOVING_AVERAGE_WINDOW,
        "runs": entries,
    }

    index_path = data_dir / "index.json"
    with open(index_path, "w", encoding="utf-8") as handle:
        json.dump(index, handle, indent=2, allow_nan=False)
        handle.write("\n")

    say(f"wrote {index_path.relative_to(REPO_ROOT) if index_path.is_relative_to(REPO_ROOT) else index_path} with {len(entries)} run(s)")
    return index


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--runs-dir", type=Path, default=RUNS_DIR)
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR)
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()
    sync(runs_dir=args.runs_dir, data_dir=args.data_dir, quiet=args.quiet)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
