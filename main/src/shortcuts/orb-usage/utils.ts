import { Point } from "@nut-tree-fork/nut-js";

// Human-like randomization utilities
export function getRandomTimeout(
  baseTimeout: number,
  variance: number = 0.3
): number {
  const min = Math.max(50, baseTimeout * (1 - variance));
  const max = baseTimeout * (1 + variance);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getHumanizedPosition(
  baseX: number,
  baseY: number,
  randomSquareSize: number = 36
): Point {
  const halfSize = randomSquareSize / 2;

  // Randomize position within the centered rectangle
  const randomX = baseX - halfSize + Math.random() * randomSquareSize;
  const randomY = baseY - halfSize + Math.random() * randomSquareSize;

  return new Point(Math.floor(randomX), Math.floor(randomY));
}
// Helper function to create position key
export function getPositionKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;

  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
