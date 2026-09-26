"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  MAX_EPISODE_STEPS,
  TAU,
  THETA_THRESHOLD_RADIANS,
  X_THRESHOLD,
  observation,
  resetState,
  step,
  type CartPoleState,
} from "@/lib/cartpole";
import {
  forward,
  greedyAction,
  parsePolicy,
  sampleAction,
  describePolicy,
  type Policy,
} from "@/lib/policy";
import { runDataUrl } from "@/lib/runs";
import { useResolvedTheme } from "@/lib/theme";

/**
 * CartPole, running entirely in the browser.
 *
 * The physics come from `lib/cartpole.ts` and the action comes from
 * `lib/policy.ts`, which replays weights exported from the trained PyTorch
 * model. Nothing here talks to a server. The only request is for the run's
 * `policy.json`, which shipped with the build.
 */

export type DemoRun = {
  name: string;
  synthetic: boolean;
};

type Mode = "sample" | "greedy";

type EndReason = "pole fell" | "cart left the track" | "reached the 500 step cap" | null;

type Display = {
  steps: number;
  episodes: number;
  lastSteps: number | null;
  bestSteps: number;
  probabilities: number[] | null;
  endReason: EndReason;
  state: CartPoleState;
};

/** Everything the animation loop mutates, kept out of React so it can run at 50Hz. */
type Simulation = {
  state: CartPoleState;
  steps: number;
  episodes: number;
  lastSteps: number | null;
  bestSteps: number;
  terminated: boolean;
  endReason: EndReason;
  probabilities: number[] | null;
};

const STILL: CartPoleState = { x: 0, xDot: 0, theta: 0, thetaDot: 0 };

/** What the readout shows before the first frame. Identical on server and client. */
const INITIAL_DISPLAY: Display = {
  steps: 0,
  episodes: 0,
  lastSteps: null,
  bestSteps: 0,
  probabilities: null,
  endReason: null,
  state: STILL,
};

function freshSimulation(): Simulation {
  return {
    state: STILL,
    steps: 0,
    episodes: 0,
    lastSteps: null,
    bestSteps: 0,
    terminated: false,
    endReason: null,
    probabilities: null,
  };
}

type Loaded =
  | { run: string; status: "ready"; policy: Policy }
  | { run: string; status: "error"; message: string };

export function CartPoleDemo({ runs }: { runs: DemoRun[] }) {
  const [selectedRun, setSelectedRun] = useState<string | null>(runs[0]?.name ?? null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [mode, setMode] = useState<Mode>("sample");
  const [preferRandomAgent, setPreferRandomAgent] = useState(runs.length === 0);
  const [running, setRunning] = useState(true);

  const theme = useResolvedTheme();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simulation = useRef<Simulation>(freshSimulation());
  const [display, setDisplay] = useState<Display>(INITIAL_DISPLAY);

  // Load the selected run's exported weights. State is only written from the
  // async callbacks, and what came back is tagged with the run it belongs to,
  // so switching runs cannot show the previous run's policy.
  useEffect(() => {
    if (!selectedRun) return;
    const run = selectedRun;

    fetch(runDataUrl(run, "policy.json"))
      .then(async (response) => {
        if (response.status === 404) {
          // As on the runs page: a cached page can name a run that the current
          // publish has dropped.
          throw new Error(
            "this run is no longer published, reload the page for the current list",
          );
        }
        if (!response.ok) throw new Error(`policy.json returned ${response.status}`);
        return response.json();
      })
      .then((data: unknown) => {
        setLoaded({ run, status: "ready", policy: parsePolicy(data) });
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

  // The animation loop reads the controls through refs, so changing one does
  // not restart the loop and throw away the episode in progress. Refs are
  // written in an effect rather than during render, because a render can be
  // discarded and repeated.
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
    sim.state = resetState();
    sim.steps = 0;
    sim.terminated = false;
    sim.endReason = null;
    sim.probabilities = null;
    setDisplay(toDisplay(sim));
  }, []);

  const resetAll = useCallback(() => {
    simulation.current = freshSimulation();
    setDisplay(toDisplay(simulation.current));
  }, []);

  // The animation loop. Mounted once and left alone.
  useEffect(() => {
    // The very first episode starts here rather than in the ref initialiser,
    // so nothing random happens while rendering.
    simulation.current.state = resetState();

    let frame = 0;
    let previous = performance.now();
    let accumulator = 0;
    let holdUntil = 0;
    let lastPublish = 0;

    const advance = () => {
      const sim = simulation.current;
      const probabilities = randomRef.current
        ? null
        : forward(policyRef.current as Policy, observation(sim.state));
      sim.probabilities = probabilities;

      const action = probabilities
        ? modeRef.current === "greedy"
          ? greedyAction(probabilities)
          : sampleAction(probabilities)
        : Math.random() < 0.5
          ? 0
          : 1;

      const outcome = step(sim.state, action);
      sim.state = outcome.state;
      sim.steps += 1;

      if (outcome.terminated || sim.steps >= MAX_EPISODE_STEPS) {
        sim.terminated = true;
        sim.endReason = !outcome.terminated
          ? "reached the 500 step cap"
          : Math.abs(sim.state.x) > X_THRESHOLD
            ? "cart left the track"
            : "pole fell";
        sim.episodes += 1;
        sim.lastSteps = sim.steps;
        sim.bestSteps = Math.max(sim.bestSteps, sim.steps);
      }
    };

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const elapsed = Math.min((now - previous) / 1000, 0.25);
      previous = now;

      if (runningRef.current) {
        const sim = simulation.current;
        if (sim.terminated) {
          // Hold the failed pose for a moment so it is visible, then start over.
          if (holdUntil === 0) holdUntil = now + 700;
          if (now >= holdUntil) {
            holdUntil = 0;
            accumulator = 0;
            sim.state = resetState();
            sim.steps = 0;
            sim.terminated = false;
            sim.endReason = null;
          }
        } else {
          accumulator += elapsed;
          // Fixed timestep, so the simulation runs at the same speed the
          // environment does regardless of the display refresh rate.
          while (accumulator >= TAU && !simulation.current.terminated) {
            accumulator -= TAU;
            advance();
          }
        }
      }

      draw(canvasRef.current, simulation.current, themeRef.current);

      if (now - lastPublish > 90) {
        lastPublish = now;
        setDisplay(toDisplay(simulation.current));
      }
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Keep the canvas crisp on high density screens and when the window resizes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      draw(canvas, simulation.current, themeRef.current);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const hasRuns = runs.length > 0;

  return (
    <div>
      {!hasRuns ? (
        <p className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          No run has exported weights yet, so this is a random agent. The trained
          policy will appear here after the first run finishes and{" "}
          <code className="font-mono">export_policy</code> writes its{" "}
          <code className="font-mono">policy.json</code>.
        </p>
      ) : null}

      {policyError ? (
        <p className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          Could not load the weights for this run: {policyError}. Falling back to
          the random agent.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <canvas
          ref={canvasRef}
          className="block h-56 w-full sm:h-72"
          role="img"
          aria-label="CartPole simulation"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <Stat label="steps this episode" value={display.steps} />
        <Stat label="last episode" value={display.lastSteps ?? "n/a"} />
        <Stat label="best" value={display.bestSteps} />
        <Stat label="episodes" value={display.episodes} />
        {display.endReason ? (
          <span className="text-zinc-500 dark:text-zinc-400">{display.endReason}</span>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
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
          Reset
        </button>
        <button
          type="button"
          onClick={resetAll}
          className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Clear counters
        </button>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Agent</legend>

          {hasRuns ? (
            <label className="mb-3 block">
              <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
                Run
              </span>
              <select
                value={selectedRun ?? ""}
                onChange={(event) => setSelectedRun(event.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {runs.map((run) => (
                  <option key={run.name} value={run.name}>
                    {run.name}
                    {run.synthetic ? " (synthetic)" : ""}
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
                    ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500"
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
              className="size-4 accent-indigo-600 disabled:opacity-40"
            />
            Random agent
          </label>

          <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            {agentIsRandom
              ? "Actions are coin flips. Expect the pole to fall in roughly twenty steps."
              : mode === "sample"
                ? "Actions are drawn from the policy distribution, which is what REINFORCE does while it trains."
                : "Always takes the most likely action. Usually steadier than sampling."}
          </p>
        </fieldset>

        <div>
          <h3 className="mb-2 text-sm font-medium">Action probabilities</h3>
          {display.probabilities ? (
            <div className="space-y-2">
              <ProbabilityBar label="push left" value={display.probabilities[0] ?? 0} />
              <ProbabilityBar label="push right" value={display.probabilities[1] ?? 0} />
            </div>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              The random agent has no policy to read. Turn it off to watch the
              network decide.
            </p>
          )}

          {policy ? (
            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
              {policy.env}, layers {describePolicy(policy)}, {policy.activation}{" "}
              between layers and softmax on the output.
            </p>
          ) : null}

          <dl className="tabular mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            <Observation label="cart position" value={display.state.x} />
            <Observation label="cart velocity" value={display.state.xDot} />
            <Observation label="pole angle" value={display.state.theta} />
            <Observation label="pole velocity" value={display.state.thetaDot} />
          </dl>
        </div>
      </div>
    </div>
  );
}

function toDisplay(sim: Simulation): Display {
  return {
    steps: sim.steps,
    episodes: sim.episodes,
    lastSteps: sim.lastSteps,
    bestSteps: sim.bestSteps,
    probabilities: sim.probabilities,
    endReason: sim.endReason,
    state: sim.state,
  };
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="tabular text-lg font-semibold">{value}</span>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
    </span>
  );
}

function Observation({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{label}</dt>
      <dd className="font-mono">{value.toFixed(3)}</dd>
    </div>
  );
}

function ProbabilityBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>{label}</span>
        <span className="tabular font-mono">{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500"
          style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Draw the scene.
 *
 * Proportions follow the Gymnasium renderer: the visible world is the full
 * track, the cart is 0.4 world units wide and the pole is one unit long, which
 * is twice the half-length used by the physics.
 */
function draw(
  canvas: HTMLCanvasElement | null,
  sim: Simulation,
  theme: "light" | "dark",
): void {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;

  const ratio = window.devicePixelRatio || 1;
  const width = canvas.width / ratio;
  const height = canvas.height / ratio;

  const colors =
    theme === "dark"
      ? {
          background: "#18181b",
          track: "#3f3f46",
          limit: "#52525b",
          cart: "#e4e4e7",
          pole: "#818cf8",
          axle: "#27272a",
          failed: "#f87171",
        }
      : {
          background: "#fafafa",
          track: "#d4d4d8",
          limit: "#a1a1aa",
          cart: "#3f3f46",
          pole: "#4f46e5",
          axle: "#fafafa",
          failed: "#dc2626",
        };

  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = colors.background;
  context.fillRect(0, 0, width, height);

  const worldWidth = X_THRESHOLD * 2;
  const scale = width / worldWidth;
  const trackY = height * 0.72;
  const cartWidth = 0.4 * scale;
  const cartHeight = 0.24 * scale;
  const poleLength = 1.0 * scale;
  const poleWidth = Math.max(3, 0.06 * scale);
  const centreX = width / 2;

  // Track and the positions where the episode ends.
  context.strokeStyle = colors.track;
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(0, trackY);
  context.lineTo(width, trackY);
  context.stroke();

  context.strokeStyle = colors.limit;
  context.setLineDash([4, 4]);
  for (const limit of [-X_THRESHOLD, X_THRESHOLD]) {
    const x = centreX + limit * scale;
    context.beginPath();
    context.moveTo(x, trackY - cartHeight * 1.6);
    context.lineTo(x, trackY + cartHeight * 0.8);
    context.stroke();
  }
  context.setLineDash([]);

  const cartX = centreX + sim.state.x * scale;
  const failed = sim.terminated;

  // Cart.
  context.fillStyle = failed ? colors.failed : colors.cart;
  roundedRect(
    context,
    cartX - cartWidth / 2,
    trackY - cartHeight / 2,
    cartWidth,
    cartHeight,
    Math.min(4, cartHeight / 3),
  );
  context.fill();

  // Pole. Positive theta leans to the right, as in the physics.
  const tipX = cartX + Math.sin(sim.state.theta) * poleLength;
  const tipY = trackY - cartHeight / 2 - Math.cos(sim.state.theta) * poleLength;
  context.strokeStyle = failed ? colors.failed : colors.pole;
  context.lineWidth = poleWidth;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(cartX, trackY - cartHeight / 2);
  context.lineTo(tipX, tipY);
  context.stroke();

  // Axle.
  context.fillStyle = colors.axle;
  context.beginPath();
  context.arc(cartX, trackY - cartHeight / 2, poleWidth * 0.4, 0, Math.PI * 2);
  context.fill();

  // How close the pole is to the twelve degree limit.
  const tilt = Math.abs(sim.state.theta) / THETA_THRESHOLD_RADIANS;
  context.fillStyle = colors.limit;
  context.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.textAlign = "right";
  context.fillText(
    `${((sim.state.theta * 180) / Math.PI).toFixed(1)}° of 12°`,
    width - 10,
    18,
  );
  context.textAlign = "left";
  context.fillText(tilt > 0.75 ? "close to falling" : "", 10, 18);
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}
