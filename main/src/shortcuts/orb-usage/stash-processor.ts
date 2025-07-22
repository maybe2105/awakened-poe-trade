import { OverlayWindow } from "../../windowing/OverlayWindow";
import type { OcrWorker } from "../../vision/link-main";
import type {
  ProcessStashOptions,
  ItemProcessResult,
  StashGrid,
} from "./types";
import { STASH } from "./constants";
import { getRandomTimeout } from "./utils";
import {
  initializeStopMechanisms,
  cleanupStopMechanisms,
  shouldStop,
  shouldSkipPosition,
  recordPositionResult,
  FLAG,
} from "./state";
import { processItem } from "./processor";
import { uIOhook, UiohookKey as Key } from "uiohook-napi";
import { Logger } from "../../RemoteLogger";

/**
 * Process all items in stash using grid pattern - SIMPLIFIED ROUND-BASED VERSION
 */
export async function processStashItems(
  ocrWorker: OcrWorker,
  overlay: OverlayWindow,
  options: ProcessStashOptions = {},
  logger: Logger
): Promise<ItemProcessResult[]> {
  
  const {
    maxAttempts = 2, // Number of rounds to process the full grid
    delayBetweenItems = 150,
    delayBetweenRounds = 300,
    stashGrid = { width: 3, height: 12 },
    itemGrid = { width: 1, height: 1 },
    onItemProcessed,
    onRoundComplete,
    onComplete,
  } = options;

  overlay.assertGameActive();

  // Initialize enhanced stopping mechanisms
  const cleanup = await initializeStopMechanisms();
  uIOhook.keyToggle(Key.Shift, "down");

  // Clear processed positions for new operation
  FLAG.processedPositions.clear();

  const allResults: ItemProcessResult[] = [];
  const grid: StashGrid = {
    startX: STASH.start.x,
    startY: STASH.start.y,
    width: stashGrid.width,
    height: stashGrid.height,
    itemSize: STASH.gridSize,
  };

  let totalProcessed = 0;
  let totalSkipped = 0;

  console.log(
    `Processing stash grid: ${grid.width}x${grid.height} for ${maxAttempts} rounds`
  );

  try {
    // Process multiple rounds
    for (let round = 0; round < maxAttempts && !(await shouldStop()); round++) {
      console.log(`\n=== Starting Round ${round + 1}/${maxAttempts} ===`);

      // Capture screenshot once per round
      const screenshot = overlay.screenshot();

      let roundProcessed = 0;
      let roundSkipped = 0;

      // Process full grid for this round
      for (
        let col = 0;
        col < grid.width && !(await shouldStop());
        col += itemGrid.width
      ) {
        for (
          let row = 0;
          row < grid.height && !(await shouldStop());
          row += itemGrid.height
        ) {
          // Skip positions that are already matched (colored)
          if (shouldSkipPosition(row, col)) {
            roundSkipped++;
            totalSkipped++;
            continue; // Skip this position entirely
          }

          const itemX = grid.startX + col * grid.itemSize;
          const itemY = grid.startY + row * grid.itemSize;

          // Enable mouse movement monitoring after first few items
          if (!FLAG.monitorMouseMovement) {
            FLAG.monitorMouseMovement = true;
          }

          // Pass the shared screenshot to avoid capturing for each item
          const result = await processItem(
            itemX,
            itemY,
            ocrWorker,
            overlay,
            options,
            screenshot,
            logger
          );
          allResults.push(result);

          // Record this position's result for future rounds
          recordPositionResult(row, col, result);

          if (result.processed) {
            totalProcessed++;
            roundProcessed++;
          }

          if (onItemProcessed) {
            onItemProcessed(result, row, col, round + 1);
          }

          if (delayBetweenItems > 0) {
            await new Promise((resolve) =>
              setTimeout(resolve, getRandomTimeout(delayBetweenItems, 0.25))
            );
          }
        }
      }

      if (onRoundComplete) {
        onRoundComplete(round + 1);
      }

      // Delay between rounds (except after the last round)
      if (
        round < maxAttempts - 1 &&
        !(await shouldStop()) &&
        delayBetweenRounds > 0
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, getRandomTimeout(delayBetweenRounds, 0.2))
        );
      }
    }

    if (onComplete) {
      onComplete(totalProcessed);
    }
  } finally {
    // Always cleanup, regardless of how we exit
    cleanup();
    cleanupStopMechanisms();
  }

  return allResults;
}
