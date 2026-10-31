"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  GRID_SIZE,
  GOAL,
  MAX_STEPS,
  isGoal,
  observation,
  resetCell,
  step,
  type Cell,
} from "@/lib/gridworld";
import {
  describePolicy,
  forward,
  greedyAction,
  parsePolicy,
  sampleAction,
  type Policy,
} from "@/lib/policy";
import { runDataUrl } from "@/lib/runs";
import { useResolvedTheme } from "@/lib/theme";

/**
 * The gridworld, running in the browser.
 *
 * Same arrangement as the CartPole demo: physics, or here just grid movement,
 * comes from lib/gridworld.ts and the action comes from lib/policy.ts replaying
 * exported weights. The two counters are what this view is for. A policy
 * trained on the proxy should be visibly circling beside the goal with its
 * proxy counter climbing while its true counter sits at zero.
 */

export type DemoRun = {
  name: string;
  baseline: boolean;
  rewardMode: string | null;
};

type Mode = "sample" | "greedy";
type Ending = "reached the goal" | "ran out of steps" | null;

const STEP_MS = 160;
const PAUSE_AFTER_EPISODE_MS = 900;
const TRAIL_LENGTH = 8;

type Simulation = {
  cell: Cell;
  steps: number;
  episodes: number;
  trueTotal: number;
  proxyTotal: number;
  lastTrue: number | null;
  lastProxy: number | null;
  goalsReached: number;
  finished: boolean;
  ending: Ending;
  probabilities: number[] | null;
  trail: Cell[];
};

function freshSimulation(): Simulation {
  return {
    cell: resetCell(),
    steps: 0,
    episodes: 0,
    trueTotal: 0,
    proxyTotal: 0,
    lastTrue: null,
    lastProxy: null,
    goalsReached: 0,
    finished: false,
    ending: null,
    probabilities: null,
    trail: [],
  };
}

type Loaded =
  | { run: string; status: "ready"; policy: Policy }
  | { run: string; status: "error"; message: string };

export function GridWorldDemo({ runs }: { runs: DemoRun[] }) {
  const [selectedRun, setSelectedRun] = useState<string | null>(runs[0]?.name ?? null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [mode, setMode] = useState<Mode>("sample");
  const [preferRandomAgent, setPreferRandomAgent] = useState(runs.length === 0);
  const [running, setRunning] = useState(true);

  const theme = useResolvedTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simulation = useRef<Simulation>(freshSimulation());
  const [display, setDisplay] = useState<Simulation>(freshSimulation);

  useEffect(() => {
    if (!selectedRun) return;
    const run = selectedRun;

    fetch(runDataUrl(run, "policy.json"))
      .then(async (response) => {
        if (response.status === 404) {
          throw new Error("this run is no longer published, reload the page");
        }
        if (!response.ok) throw new Error(`policy.json returned ${response.status}`);
        return response.json();
      })
      .then((data: unknown) => {
        const policy = parsePolicy(data);
        // A CartPole policy would load without complaint and then act on
        // nonsense, so check the shape matches this environment.
        const inputs = policy.layers[0].weight[0].length;
        const outputs = policy.layers[policy.layers.length - 1].weight.length;
        if (inputs !== 2 || outputs !== 4) {
          throw new Error(
            `this policy takes ${inputs} inputs and gives ${outputs} actions, the gridworld needs 2 and 4`,
          );
        }
        setLoaded({ run, status: "ready", policy });
      })
      .catch((error: unknown) => {
        setLoaded({
          run,
          status: "error",
          message: error instanceof Error ? error.message : "could not load the policy",
        });
      });
  }, [selectedRun]);

  const current = loaded !== null && loaded.run === selectedRun ? loaded : null;
  const policy = current?.status === "ready" ? current.policy : null;
  const policyError = current?.status === "error" ? current.message : null;
  const agentIsRandom = preferRandomAgent || policy === null;

  const policyRef = useRef<Policy | null>(null);
  const modeRef = useRef<Mode>("sample");
  const randomRef = useRef(true);
  const runningRef = useRef(true);
  const themeRef = useRef<"light" | "dark">("light");

  useEffect(() => {
    policyRef.current = policy;
    modeRef.current = mode;
    randomRef.current = agentIsRandom;
    runningRef.current = running;
    themeRef.current = theme;
  });

  const reset = useCallback(() => {
    const sim = simulation.current;
    sim.cell = resetCell();
    sim.steps = 0;
    sim.trueTotal = 0;
    sim.proxyTotal = 0;
    sim.finished = false;
    sim.ending = null;
    sim.trail = [];
    setDisplay({ ...sim });
  }, []);

  const clearCounters = useCallback(() => {
    simulation.current = freshSimulation();
    setDisplay({ ...simulation.current });
  }, []);

  useEffect(() => {
    let frame = 0;
    let nextStepAt = 0;

    const advance = () => {
      const sim = simulation.current;
      const probabilities = randomRef.current
        ? null
        : forward(policyRef.current as Policy, observation(sim.cell));
      sim.probabilities = probabilities;

      const action = probabilities
        ? modeRef.current === "greedy"
          ? greedyAction(probabilities)
          : sampleAction(probabilities)
        : Math.floor(Math.random() * 4);

      const outcome = step(sim.cell, action);
      sim.trail = [...sim.trail, sim.cell].slice(-TRAIL_LENGTH);
      sim.cell = outcome.cell;
      sim.steps += 1;
      sim.trueTotal += outcome.trueReward;
      sim.proxyTotal += outcome.proxyReward;

      if (outcome.terminated || sim.steps >= MAX_STEPS) {
        sim.finished = true;
        sim.ending = outcome.terminated ? "reached the goal" : "ran out of steps";
        sim.episodes += 1;
        sim.lastTrue = sim.trueTotal;
        sim.lastProxy = sim.proxyTotal;
        if (outcome.terminated) sim.goalsReached += 1;
      }
    };

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const sim = simulation.current;

      if (runningRef.current && now >= nextStepAt) {
        if (sim.finished) {
          // Hold the final position for a moment so the ending is readable.
          nextStepAt = now + PAUSE_AFTER_EPISODE_MS;
          sim.cell = resetCell();
          sim.steps = 0;
          sim.trueTotal = 0;
          sim.proxyTotal = 0;
          sim.finished = false;
          sim.ending = null;
          sim.trail = [];
        } else {
          nextStepAt = now + STEP_MS;
          advance();
        }
        setDisplay({ ...sim });
      }

      draw(canvasRef.current, sim, themeRef.current);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
      draw(canvas, simulation.current, themeRef.current);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  return (
    <div>
      {runs.length === 0 ? (
        <p className="mb-6 border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          No gridworld run has exported weights yet, so this is a random agent.
          Even random movement farms the proxy, which is the first hint that the
          reward is wrong.
        </p>
      ) : null}

      {policyError ? (
        <p className="mb-6 border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          Could not load the weights for this run: {policyError}. Falling back to
          the random agent.
        </p>
      ) : null}

      <div className="grid gap-8 sm:grid-cols-[minmax(0,320px)_1fr]">
        <div>
          <canvas
            ref={canvasRef}
            className="block aspect-square w-full max-w-[320px]"
            role="img"
            aria-label="Gridworld simulation"
          />
        </div>

        <div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-5">
            <Counter
              label="proxy reward"
              value={display.proxyTotal}
              digits={2}
              tone="proxy"
              note="what the agent is paid"
            />
            <Counter
              label="true reward"
              value={display.trueTotal}
              digits={2}
              tone="true"
              note="what we actually wanted"
            />
            <Counter label="step" value={display.steps} digits={0} note={`of ${MAX_STEPS}`} />
            <Counter
              label="goals reached"
              value={display.goalsReached}
              digits={0}
              note={`in ${display.episodes} episodes`}
            />
          </dl>

          {display.ending ? (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              {display.ending}
            </p>
          ) : null}

          <div className="mt-6">
            <h3 className="mb-2 text-sm font-medium">Action probabilities</h3>
            {display.probabilities ? (
              <div className="space-y-1.5">
                {(["up", "down", "left", "right"] as const).map((label, index) => (
                  <ProbabilityBar
                    key={label}
                    label={label}
                    value={display.probabilities?.[index] ?? 0}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                The random agent has no policy to read. Turn it off once a
                trained gridworld run exists.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setRunning((value) => !value)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {running ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Reset episode
        </button>
        <button
          type="button"
          onClick={clearCounters}
          className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Clear counters
        </button>
      </div>

      <fieldset className="mt-8">
        <legend className="mb-2 text-sm font-medium">Agent</legend>

        {runs.length > 0 ? (
          <label className="mb-3 block max-w-sm">
            <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Run</span>
            <select
              value={selectedRun ?? ""}
              onChange={(event) => setSelectedRun(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {runs.map((run) => (
                <option key={run.name} value={run.name}>
                  {run.name}
                  {run.rewardMode ? ` (trained on ${run.rewardMode})` : ""}
                  {run.baseline ? " (random baseline)" : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="flex gap-2">
          {(["sample", "greedy"] as const).map((option) => (
            <button
              key={option}
              type="button"
              disabled={agentIsRandom}
              onClick={() => setMode(option)}
              className={[
                "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                mode === option && !agentIsRandom
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800",
                agentIsRandom ? "cursor-not-allowed opacity-40" : "",
              ].join(" ")}
            >
              {option === "sample" ? "Sample from policy" : "Greedy"}
            </button>
          ))}
        </div>

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={agentIsRandom}
            disabled={policy === null}
            onChange={(event) => setPreferRandomAgent(event.target.checked)}
            className="size-4 disabled:opacity-40"
          />
          Random agent
        </label>

        {policy ? (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            gridworld, layers {describePolicy(policy)}, {policy.activation} between
            layers and softmax on the output.
          </p>
        ) : null}
      </fieldset>
    </div>
  );
}

function Counter({
  label,
  value,
  digits,
  note,
  tone,
}: {
  label: string;
  value: number;
  digits: number;
  note?: string;
  tone?: "true" | "proxy";
}) {
  const colour =
    tone === "proxy"
      ? "text-amber-700 dark:text-amber-400"
      : tone === "true"
        ? "text-teal-700 dark:text-teal-400"
        : "";
  return (
    <div>
      <dt className="text-xs tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {label}
      </dt>
      <dd className={`tabular mt-0.5 font-mono text-2xl ${colour}`}>
        {value.toFixed(digits)}
      </dd>
      {note ? (
        <dd className="text-xs text-zinc-500 dark:text-zinc-500">{note}</dd>
      ) : null}
    </div>
  );
}

function ProbabilityBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="h-1 grow overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <span
          className="block h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
          style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
        />
      </span>
      <span className="tabular w-12 text-right font-mono text-xs text-zinc-500 dark:text-zinc-400">
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}

/** Draw the grid, the goal, the recent trail and the agent. */
function draw(
  canvas: HTMLCanvasElement | null,
  sim: Simulation,
  theme: "light" | "dark",
): void {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;

  const ratio = window.devicePixelRatio || 1;
  const size = canvas.width / ratio;
  const cell = size / GRID_SIZE;

  const colours =
    theme === "dark"
      ? {
          background: "#18181b",
          line: "#3f3f46",
          goal: "#2dd4bf",
          agent: "#fafafa",
          trail: "#52525b",
          text: "#a1a1aa",
        }
      : {
          background: "#fafafa",
          line: "#d4d4d8",
          goal: "#0d9488",
          agent: "#18181b",
          trail: "#d4d4d8",
          text: "#71717a",
        };

  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.fillStyle = colours.background;
  context.fillRect(0, 0, size, size);

  // Goal square, drawn under the grid lines.
  context.fillStyle = colours.goal;
  context.globalAlpha = 0.18;
  context.fillRect(GOAL.column * cell, GOAL.row * cell, cell, cell);
  context.globalAlpha = 1;

  context.strokeStyle = colours.line;
  context.lineWidth = 1;
  for (let i = 0; i <= GRID_SIZE; i += 1) {
    const at = Math.round(i * cell) + 0.5;
    context.beginPath();
    context.moveTo(at, 0);
    context.lineTo(at, size);
    context.moveTo(0, at);
    context.lineTo(size, at);
    context.stroke();
  }

  // Where it has just been, which is how oscillation becomes visible.
  sim.trail.forEach((past, index) => {
    const strength = (index + 1) / (sim.trail.length + 1);
    context.fillStyle = colours.trail;
    context.globalAlpha = 0.5 * strength;
    context.beginPath();
    context.arc(
      (past.column + 0.5) * cell,
      (past.row + 0.5) * cell,
      cell * 0.12,
      0,
      Math.PI * 2,
    );
    context.fill();
  });
  context.globalAlpha = 1;

  context.fillStyle = colours.text;
  context.font = `${Math.round(cell * 0.2)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  context.textAlign = "center";
  context.fillText("goal", (GOAL.column + 0.5) * cell, (GOAL.row + 0.78) * cell);

  context.fillStyle = isGoal(sim.cell) ? colours.goal : colours.agent;
  context.beginPath();
  context.arc(
    (sim.cell.column + 0.5) * cell,
    (sim.cell.row + 0.5) * cell,
    cell * 0.26,
    0,
    Math.PI * 2,
  );
  context.fill();
}
