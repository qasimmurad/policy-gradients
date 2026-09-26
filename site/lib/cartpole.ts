/**
 * CartPole-v1, reimplemented in TypeScript.
 *
 * These are the equations Gymnasium uses in
 * `gymnasium/envs/classic_control/cartpole.py`, with the same constants, the
 * same Euler integration and the same termination test, so a policy trained
 * against Gymnasium behaves the same way here as it did during training.
 *
 * The state is [x, xDot, theta, thetaDot], which is also the observation the
 * policy network receives, in that order. Action 0 pushes the cart left and
 * action 1 pushes it right.
 */

export const GRAVITY = 9.8;
export const MASS_CART = 1.0;
export const MASS_POLE = 0.1;
export const TOTAL_MASS = MASS_POLE + MASS_CART;
/** Half the pole's length, which is what the equations use. */
export const LENGTH = 0.5;
export const POLE_MASS_LENGTH = MASS_POLE * LENGTH;
export const FORCE_MAG = 10.0;
/** Seconds between steps. Fifty steps per second. */
export const TAU = 0.02;
export const THETA_THRESHOLD_RADIANS = (12 * 2 * Math.PI) / 360;
export const X_THRESHOLD = 2.4;
/** CartPole-v1 truncates here, which is also the maximum score. */
export const MAX_EPISODE_STEPS = 500;

export type CartPoleState = {
  x: number;
  xDot: number;
  theta: number;
  thetaDot: number;
};

export type StepOutcome = {
  state: CartPoleState;
  terminated: boolean;
};

/** Every state variable starts uniform in [-0.05, 0.05], as Gymnasium does. */
export function resetState(random: () => number = Math.random): CartPoleState {
  const uniform = () => random() * 0.1 - 0.05;
  return { x: uniform(), xDot: uniform(), theta: uniform(), thetaDot: uniform() };
}

export function observation(state: CartPoleState): number[] {
  return [state.x, state.xDot, state.theta, state.thetaDot];
}

/**
 * Advance the physics one timestep.
 *
 * Straight from the Gymnasium source: solve for the angular acceleration of the
 * pole, back out the acceleration of the cart, then integrate with Euler.
 */
export function step(state: CartPoleState, action: number): StepOutcome {
  const force = action === 1 ? FORCE_MAG : -FORCE_MAG;
  const cosTheta = Math.cos(state.theta);
  const sinTheta = Math.sin(state.theta);

  const temp =
    (force + POLE_MASS_LENGTH * state.thetaDot * state.thetaDot * sinTheta) / TOTAL_MASS;
  const thetaAcc =
    (GRAVITY * sinTheta - cosTheta * temp) /
    (LENGTH * (4.0 / 3.0 - (MASS_POLE * cosTheta * cosTheta) / TOTAL_MASS));
  const xAcc = temp - (POLE_MASS_LENGTH * thetaAcc * cosTheta) / TOTAL_MASS;

  const next: CartPoleState = {
    x: state.x + TAU * state.xDot,
    xDot: state.xDot + TAU * xAcc,
    theta: state.theta + TAU * state.thetaDot,
    thetaDot: state.thetaDot + TAU * thetaAcc,
  };

  return { state: next, terminated: isTerminated(next) };
}

/** The pole fell past twelve degrees, or the cart ran off the track. */
export function isTerminated(state: CartPoleState): boolean {
  return (
    state.x < -X_THRESHOLD ||
    state.x > X_THRESHOLD ||
    state.theta < -THETA_THRESHOLD_RADIANS ||
    state.theta > THETA_THRESHOLD_RADIANS
  );
}

/** Small seeded generator, so a demo episode can be replayed exactly. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
