/**
 * The gridworld, reimplemented in TypeScript.
 *
 * This mirrors `rl/envs/gridworld.py` constant for constant so a policy trained
 * against the Python environment behaves here exactly as it did in training.
 * If one of them changes, the other has to change with it.
 *
 * The proxy reward is the misspecified one: it pays +0.1 for a step towards the
 * goal and charges only -0.01 for a step away, so an agent beside the goal can
 * step off and back forever at +0.09 every two steps while never scoring any
 * true reward at all. Watching those two counters separate is the point of the
 * gridworld view on the demo page.
 */

export const GRID_SIZE = 5;
export const START: Cell = { row: 0, column: 0 };
export const GOAL: Cell = { row: GRID_SIZE - 1, column: GRID_SIZE - 1 };
export const MAX_STEPS = 50;

export const GOAL_BONUS = 1.0;
export const CLOSER_REWARD = 0.1;
export const FURTHER_REWARD = -0.01;

export type Cell = { row: number; column: number };

/** Action order matches rl/envs/gridworld.py, which is what the policy was trained on. */
export const ACTIONS = ["up", "down", "left", "right"] as const;
export type Action = 0 | 1 | 2 | 3;

const DELTAS: Record<number, Cell> = {
  0: { row: -1, column: 0 },
  1: { row: 1, column: 0 },
  2: { row: 0, column: -1 },
  3: { row: 0, column: 1 },
};

export type StepOutcome = {
  cell: Cell;
  trueReward: number;
  proxyReward: number;
  terminated: boolean;
  /** True when the move was blocked by the edge of the grid. */
  bumped: boolean;
};

export function manhattanToGoal(cell: Cell): number {
  return Math.abs(cell.row - GOAL.row) + Math.abs(cell.column - GOAL.column);
}

export function isGoal(cell: Cell): boolean {
  return cell.row === GOAL.row && cell.column === GOAL.column;
}

/** Row and column scaled to [0, 1], which is exactly what the policy network sees. */
export function observation(cell: Cell): number[] {
  const scale = GRID_SIZE - 1;
  return [cell.row / scale, cell.column / scale];
}

/** Move one square and score the move under both reward definitions. */
export function step(cell: Cell, action: number): StepOutcome {
  const delta = DELTAS[action] ?? DELTAS[0];
  const row = cell.row + delta.row;
  const column = cell.column + delta.column;
  const inside = row >= 0 && row < GRID_SIZE && column >= 0 && column < GRID_SIZE;
  const next = inside ? { row, column } : cell;

  const reachedGoal = isGoal(next);
  const bumped = !inside;

  let shaping: number;
  if (bumped) {
    // A wall costs nothing, which is part of why loitering is cheap.
    shaping = 0;
  } else if (manhattanToGoal(next) < manhattanToGoal(cell)) {
    shaping = CLOSER_REWARD;
  } else {
    shaping = FURTHER_REWARD;
  }

  return {
    cell: next,
    trueReward: reachedGoal ? GOAL_BONUS : 0,
    proxyReward: shaping + (reachedGoal ? GOAL_BONUS : 0),
    terminated: reachedGoal,
    bumped,
  };
}

export function resetCell(): Cell {
  return { ...START };
}
