import { mouse } from "@nut-tree-fork/nut-js";
import { OverlayWindow } from "../../windowing/OverlayWindow";
import type { OcrWorker } from "../../vision/link-main";
import type { ProcessOptions, ItemProcessResult } from "./types";
import { MOUSE_TIMEOUT, STASH } from "./constants";
import { getRandomTimeout, getHumanizedPosition } from "./utils";

/**
 * Core function: Process a single item at given coordinates
 * This is the base function that all other processing functions use
 */
export async function processItem(
  x: number,
  y: number,
  ocrWorker: OcrWorker,
  overlay: OverlayWindow,
  options: ProcessOptions = {},
  screenshot?: any // Optional screenshot parameter
): Promise<ItemProcessResult> {
  const {
    delayBetweenClicks = 100,
    mouseTimeout = MOUSE_TIMEOUT,
    useOrb = false,
    customColorThresholds,
  } = options;

  const result: ItemProcessResult = {
    position: { x, y },
    isMatched: false,
    averageColor: { r: 0, g: 0, b: 0 },
    processed: false,
    isEmpty: false,
  };

  try {
    console.log(
      `\n(${Math.round((y - STASH.start.y) / STASH.gridSize)}, ${Math.round(
        (x - STASH.start.x) / STASH.gridSize
      )})`
    );

    // Move mouse to item with human-like timing
    const preMoveDelay = Math.random() < 0.3 ? getRandomTimeout(50, 0.5) : 0; // 30% chance of small pre-move delay
    if (preMoveDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, preMoveDelay));
    }

    await mouse.move([getHumanizedPosition(x, y)]);
    await new Promise((resolve) =>
      setTimeout(resolve, getRandomTimeout(mouseTimeout))
    );

    // Use provided screenshot or capture new one
    const imageData = screenshot || overlay.screenshot();
    const colorResult = await ocrWorker.readItemColors(
      imageData,
      x,
      y,
      customColorThresholds
    );

    result.isMatched = colorResult.isMatched;
    result.averageColor = colorResult.averageColor;
    result.isEmpty = colorResult.isEmpty;
    console.log(`Item: ${colorResult.isMatched ? "COLORED" : "GREY"}`);

    if (result.isMatched) {
      console.log("Skipping item - matches skip pattern");
      return result;
    }

    // Use orb if enabled
    if (useOrb) {
      // Add small random delay before click for human-like behavior
      const preClickDelay = Math.random() < 0.4 ? getRandomTimeout(30, 0.6) : 0; // 40% chance of pre-click delay
      if (preClickDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, preClickDelay));
      }

      await mouse.leftClick();
      await new Promise((resolve) =>
        setTimeout(resolve, getRandomTimeout(delayBetweenClicks, 0.2))
      );
      result.processed = true;
    }

    result.processed = true;

    return result;
  } catch (error) {
    result.error = `Error: ${error}`;
    console.log(result.error);
  }

  return result;
}
