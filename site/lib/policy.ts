/**
 * The policy forward pass, in the browser.
 *
 * This mirrors the PyTorch model in `rl/agent/`. `rl/tools/export.py` writes the
 * trained weights to `policy.json`, and the code below replays them by hand so
 * the demo can act without a server. A reader should be able to hold this file
 * next to the PyTorch module and see the same three steps:
 *
 *     PyTorch                              here
 *     ------------------------------------ ------------------------------------
 *     nn.Linear(in, out)                   matVec: y = W @ x + b
 *     F.relu(x)                            activate
 *     F.softmax(logits, dim=-1)            softmax
 *
 * Weight matrices arrive as nested arrays with shape [out_features,
 * in_features], exactly as `torch.nn.Linear.weight` stores them, so row `i` of
 * `weight` holds the incoming weights of output unit `i`.
 *
 * `rl/tools/test_tools.py` checks a freshly exported model against torch and
 * asserts the two agree, so if this file and the training code ever drift apart
 * that test is where it shows up.
 */

export type PolicyLayer = {
  weight: number[][];
  bias: number[];
};

export type Activation = "relu" | "tanh";

export type Policy = {
  env: string;
  activation: Activation;
  layers: PolicyLayer[];
  output: "softmax";
};

/** y = W @ x + b, with W stored row major as [out_features, in_features]. */
function matVec(weight: number[][], bias: number[], input: number[]): number[] {
  const output = new Array<number>(weight.length);
  for (let row = 0; row < weight.length; row += 1) {
    const weights = weight[row];
    let total = bias[row] ?? 0;
    for (let column = 0; column < weights.length; column += 1) {
      total += weights[column] * input[column];
    }
    output[row] = total;
  }
  return output;
}

function activate(values: number[], activation: Activation): number[] {
  if (activation === "tanh") return values.map(Math.tanh);
  return values.map((value) => (value > 0 ? value : 0));
}

/** Softmax, shifted by the maximum logit so large logits cannot overflow. */
export function softmax(logits: number[]): number[] {
  const largest = Math.max(...logits);
  const exponentials = logits.map((logit) => Math.exp(logit - largest));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return exponentials.map((value) => value / total);
}

/**
 * Run an observation through the network and return one probability per action.
 *
 * The activation goes between linear layers only. The last layer produces
 * logits, which softmax turns into the action distribution.
 */
export function forward(policy: Policy, observation: number[]): number[] {
  let values = observation;
  for (let index = 0; index < policy.layers.length; index += 1) {
    const layer = policy.layers[index];
    values = matVec(layer.weight, layer.bias, values);
    const isLastLayer = index === policy.layers.length - 1;
    if (!isLastLayer) {
      values = activate(values, policy.activation);
    }
  }
  return softmax(values);
}

/** The most likely action. Deterministic, which is the demo's "greedy" mode. */
export function greedyAction(probabilities: number[]): number {
  let best = 0;
  for (let index = 1; index < probabilities.length; index += 1) {
    if (probabilities[index] > probabilities[best]) best = index;
  }
  return best;
}

/**
 * Draw an action from the distribution, which is what REINFORCE does while it
 * trains. This is the demo's "sample from policy" mode.
 */
export function sampleAction(
  probabilities: number[],
  random: () => number = Math.random,
): number {
  const threshold = random();
  let cumulative = 0;
  for (let index = 0; index < probabilities.length; index += 1) {
    cumulative += probabilities[index];
    if (threshold < cumulative) return index;
  }
  return probabilities.length - 1;
}

/**
 * Check a parsed `policy.json` before trusting it.
 *
 * The file is produced by the export script and shipped with the build, so this
 * is here to catch a stale or half written export during development rather
 * than to defend against anything hostile. It returns a helpful message instead
 * of letting the demo fail with an array index error mid animation.
 */
export function parsePolicy(data: unknown): Policy {
  if (typeof data !== "object" || data === null) {
    throw new Error("policy.json is not an object");
  }
  const raw = data as Record<string, unknown>;

  const activation = raw.activation === "tanh" ? "tanh" : "relu";
  if (raw.activation !== "relu" && raw.activation !== "tanh") {
    throw new Error(
      `policy.json uses activation ${String(raw.activation)}, which the browser does not implement`,
    );
  }
  if (raw.output !== "softmax") {
    throw new Error(
      `policy.json uses output ${String(raw.output)}, which the browser does not implement`,
    );
  }
  if (!Array.isArray(raw.layers) || raw.layers.length === 0) {
    throw new Error("policy.json has no layers");
  }

  const layers: PolicyLayer[] = raw.layers.map((entry, index) => {
    const layer = entry as Record<string, unknown>;
    const weight = layer.weight;
    const bias = layer.bias;
    if (
      !Array.isArray(weight) ||
      weight.length === 0 ||
      !Array.isArray(weight[0]) ||
      !Array.isArray(bias)
    ) {
      throw new Error(`layer ${index} of policy.json is missing weight or bias`);
    }
    if (bias.length !== weight.length) {
      throw new Error(
        `layer ${index} has ${weight.length} outputs but ${bias.length} biases`,
      );
    }
    return { weight: weight as number[][], bias: bias as number[] };
  });

  for (let index = 1; index < layers.length; index += 1) {
    const inputs = layers[index].weight[0].length;
    const previousOutputs = layers[index - 1].weight.length;
    if (inputs !== previousOutputs) {
      throw new Error(
        `layer ${index} expects ${inputs} inputs but layer ${index - 1} produces ${previousOutputs}`,
      );
    }
  }

  return {
    env: typeof raw.env === "string" ? raw.env : "CartPole-v1",
    activation,
    layers,
    output: "softmax",
  };
}

/** Human readable shape, for example "4 to 128 to 2". */
export function describePolicy(policy: Policy): string {
  const sizes = [policy.layers[0].weight[0].length, ...policy.layers.map((l) => l.weight.length)];
  return sizes.join(" to ");
}
