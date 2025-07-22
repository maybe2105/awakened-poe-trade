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
  itemSize: number = 58
): Point {
  // Randomize position within the entire item area (58x58 rectangle)
  const randomX = baseX + Math.floor(Math.random() * itemSize);
  const randomY = baseY + Math.floor(Math.random() * itemSize);

  return new Point(randomX, randomY);
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
