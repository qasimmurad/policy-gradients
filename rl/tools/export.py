"""Export a trained policy network to plain JSON so a browser can run it.

The website reimplements the forward pass in TypeScript (see
`site/lib/policy.ts`). This module writes the weights in the shape that code
expects:

    {
      "env": "CartPole-v1",
      "activation": "relu",
      "layers": [
        {"weight": [[...], ...], "bias": [...]},
        {"weight": [[...], ...], "bias": [...]}
      ],
      "output": "softmax"
    }

Weight matrices are nested lists in row-major order with shape
[out_features, in_features], matching `torch.nn.Linear.weight`, so the browser
computes `y = W @ x + b` exactly as PyTorch does. Floats are rounded to six
decimals to keep the file small.

    from tools.export import export_policy

    export_policy(model, "cartpole-baseline")
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any, Optional

import torch
from torch import nn

from .logger import CONFIG_FILENAME, DEFAULT_RUNS_DIR

POLICY_FILENAME = "policy.json"
DEFAULT_ENV = "CartPole-v1"
DEFAULT_DECIMALS = 6


def _round_nested(values: Any, decimals: int) -> Any:
    if isinstance(values, list):
        return [_round_nested(item, decimals) for item in values]
    number = float(values)
    if not math.isfinite(number):
        raise ValueError(
            "policy weights contain NaN or infinity, the model did not train successfully"
        )
    return round(number, decimals)


def _linear_layers(model: nn.Module) -> list[nn.Linear]:
    """Every nn.Linear in the model, in registration order.

    For the networks used here (nn.Sequential, or a module that creates its
    layers in the order it applies them) registration order is forward order.
    """
    return [module for module in model.modules() if isinstance(module, nn.Linear)]


def _env_from_config(run_dir: Path) -> Optional[str]:
    config_path = run_dir / CONFIG_FILENAME
    if not config_path.exists():
        return None
    try:
        with open(config_path, encoding="utf-8") as handle:
            config = json.load(handle)
    except (json.JSONDecodeError, OSError):
        return None
    env = config.get("env")
    return env if isinstance(env, str) else None


def export_policy(
    model: nn.Module,
    run_name: str,
    runs_dir: Optional[str | Path] = None,
    env: Optional[str] = None,
    activation: str = "relu",
    output: str = "softmax",
    decimals: int = DEFAULT_DECIMALS,
) -> Path:
    """Write `policy.json` for a run, returning the path it wrote.

    Args:
        model: The trained policy network. Its linear layers are walked in order.
        run_name: Folder name of the run, which must already exist or will be created.
        runs_dir: Where run folders live. Defaults to `rl/runs`.
        env: Environment name. Defaults to the `env` field of the run's
            `config.json`, then to "CartPole-v1".
        activation: Activation applied between linear layers. The browser
            supports "relu" and "tanh".
        output: Applied to the final layer. The browser supports "softmax".
        decimals: Decimal places to keep for every float.
    """
    base = Path(runs_dir) if runs_dir is not None else DEFAULT_RUNS_DIR
    run_dir = base / run_name
    run_dir.mkdir(parents=True, exist_ok=True)

    layers = _linear_layers(model)
    if not layers:
        raise ValueError(
            "no nn.Linear layers found in the model, so there is nothing the browser can run"
        )

    exported = []
    previous_out: Optional[int] = None
    for index, layer in enumerate(layers):
        if previous_out is not None and layer.in_features != previous_out:
            raise ValueError(
                f"layer {index} takes {layer.in_features} inputs but the previous layer "
                f"produces {previous_out}, so the layers are not a simple chain and the "
                "browser cannot replay this model"
            )
        previous_out = layer.out_features

        with torch.no_grad():
            weight = layer.weight.detach().cpu().tolist()
            bias = (
                layer.bias.detach().cpu().tolist()
                if layer.bias is not None
                else [0.0] * layer.out_features
            )
        exported.append(
            {
                "weight": _round_nested(weight, decimals),
                "bias": _round_nested(bias, decimals),
            }
        )

    policy = {
        "env": env or _env_from_config(run_dir) or DEFAULT_ENV,
        "activation": activation,
        "layers": exported,
        "output": output,
    }

    target = run_dir / POLICY_FILENAME
    with open(target, "w", encoding="utf-8") as handle:
        json.dump(policy, handle, allow_nan=False)
        handle.write("\n")
    return target
