import { uIOhook, UiohookKey as Key } from "uiohook-napi";
import { mouse } from "@nut-tree-fork/nut-js";
import { STASH_BOUNDS } from "./constants";
import { getPositionKey } from "./utils";
import type { ItemProcessResult } from "./types";

// Enhanced stopping mechanism
export const FLAG = {
  stop: 0,
  shiftPressed: false,
  escPressed: false,
  stashBounds: STASH_BOUNDS,
  monitorMouseMovement: false, // Only start monitoring after first item
  processedPositions: new Map<
    string,
    { isMatched: boolean; isEmpty?: boolean; processed: boolean }
  >(), // Track processed positions
};

// Check if position should be skipped
export function shouldSkipPosition(row: number, col: number): boolean {
  const key = getPositionKey(row, col);
  const positionData = FLAG.processedPositions.get(key);
  return positionData?.isMatched === true || positionData?.isEmpty === true; // Skip if already processed and matched
}

// Record position result
export function recordPositionResult(
  row: number,
  col: number,
  result: ItemProcessResult
) {
  const key = getPositionKey(row, col);
  FLAG.processedPositions.set(key, {
    isMatched: result.isMatched,
    isEmpty: result.isEmpty,
    processed: result.processed,
  });
}

// Enhanced stop checking function
export async function shouldStop(): Promise<boolean> {
  if (FLAG.stop === 1) return true;
  if (FLAG.escPressed) return true;
  if (!FLAG.shiftPressed) return true; // Stop if shift is released

  // Stop if mouse moved outside stash area (only if we're monitoring)
  if (FLAG.monitorMouseMovement) {
    try {
      const currentPos = await mouse.getPosition();
      if (
        currentPos.x < FLAG.stashBounds.minX ||
        currentPos.x > FLAG.stashBounds.maxX ||
        currentPos.y < FLAG.stashBounds.minY ||
        currentPos.y > FLAG.stashBounds.maxY
      ) {
        console.log("Stopping: Mouse moved outside stash area");
        return true;
      }
    } catch (error) {
      // If we can't get mouse position, don't stop for this reason
    }
  }

  return false;
}

// Initialize stopping mechanisms
export async function initializeStopMechanisms() {
  FLAG.stop = 0;
  FLAG.escPressed = false;
  FLAG.shiftPressed = true; // Assume shift is pressed when starting
  FLAG.monitorMouseMovement = false; // Start monitoring after first item

  // Listen for key events
  const keyListener = (e: any) => {
    if (e.keycode === Key.Shift) {
      FLAG.shiftPressed = false;
      console.log("Stopping: Shift key released");
    } else if (e.keycode === Key.Escape) {
      FLAG.escPressed = true;
      console.log("Stopping: ESC key pressed");
    }
  };

  uIOhook.on("keyup", keyListener);

  // Return cleanup function
  return () => {
    uIOhook.removeListener("keyup", keyListener);
  };
}

// Clean up function
export function cleanupStopMechanisms() {
  FLAG.stop = 0;
  FLAG.shiftPressed = false;
  FLAG.escPressed = false;
  FLAG.monitorMouseMovement = false;
  FLAG.processedPositions.clear(); // Clear position tracking
  uIOhook.removeAllListeners("keyup");
}
